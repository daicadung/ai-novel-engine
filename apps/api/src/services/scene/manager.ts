import { db } from '@ane/database';
import { LLMProvider } from '../architect/llm.js';
import { ProviderFactory } from '../llm/factory.js';
import { SceneStageHandler } from './handlers.js';
import { ContinuityValidator } from './validator.js';

export class SceneManager {
  private provider: LLMProvider;
  private handler: SceneStageHandler;

  constructor(provider?: LLMProvider) {
    this.provider = provider || ProviderFactory.getProvider('SCENE');
    this.handler = new SceneStageHandler(this.provider);
  }

  async runStage(novelId: string, chapterId: string, previousSnapshotId?: string): Promise<void> {
    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new Error("Chapter not found");

    const activeJob = await db.generationJob.findFirst({
      where: { novelId, sceneStage: 'SCENE_PLAN', status: 'RUNNING' }
    });
    if (activeJob) throw new Error("Stage is already running");

    const job = await db.generationJob.create({
      data: {
        novelId,
        sceneStage: 'SCENE_PLAN',
        status: 'RUNNING',
        provider: 'MockProvider',
        startedAt: new Date()
      }
    });

    try {
      // 1. Generate Candidate
      const prompt = await this.handler.prepareInput(novelId, chapterId, previousSnapshotId);
      const fullPrompt = `${prompt}\nSTAGE: SCENE_PLAN`;
      const output = await this.handler.invoke(fullPrompt);
      
      // 2. Fetch Before State (previous snapshot)
      let prevSnapshot = null;
      if (previousSnapshotId) {
        prevSnapshot = await db.continuitySnapshot.findUnique({ where: { id: previousSnapshotId } });
      } else {
        prevSnapshot = await db.continuitySnapshot.findFirst({
          where: { novelId, chapterNumber: chapter.number - 1, status: 'CANONICAL' },
          orderBy: { createdAt: 'desc' }
        });
      }

      const beforeState = prevSnapshot ? {
        characters: prevSnapshot.characters || {},
        items: prevSnapshot.items || {},
        locations: prevSnapshot.locations || {},
        factions: prevSnapshot.factions || {},
        plotThreads: prevSnapshot.plotThreads || {},
        foreshadowing: prevSnapshot.foreshadowing || {}
      } : {
        characters: {}, items: {}, locations: {}, factions: {}, plotThreads: {}, foreshadowing: {}
      };

      // 3. Zod validation is handled by invoke()
      // 4. Domain & Continuity Validation
      const allStateChanges = output.scenes.flatMap(s => s.stateChanges);
      const afterState = ContinuityValidator.computeAfterState(beforeState, allStateChanges as any[]);

      // 5. Transactional Promotion
      await db.$transaction(async (tx) => {
        // Mark old version and scenes STALE
        const oldCanonical = await tx.scenePlanVersion.findFirst({
          where: { chapterId, status: 'CANONICAL' }
        });

        if (oldCanonical) {
          await tx.scenePlanVersion.update({
            where: { id: oldCanonical.id },
            data: { status: 'STALE' }
          });
          await tx.scene.updateMany({
            where: { scenePlanVersionId: oldCanonical.id },
            data: { status: 'STALE' }
          });
          // Note: snapshot belonging to the old version remains intact (immutable)
        }

        const newVersionNum = oldCanonical ? oldCanonical.version + 1 : 1;
        const newVersionId = await this.handler.applyCanonicalPersistence(chapterId, output, tx, newVersionNum);

        // 6. Create resulting snapshot
        await tx.continuitySnapshot.create({
          data: {
            novelId,
            chapterNumber: chapter.number,
            status: 'CANONICAL',
            previousSnapshotId: prevSnapshot?.id || null,
            sourceScenePlanVersionId: newVersionId,
            characters: afterState.characters,
            items: afterState.items,
            locations: afterState.locations,
            factions: afterState.factions,
            plotThreads: afterState.plotThreads,
            foreshadowing: afterState.foreshadowing
          }
        });
      });
      
      await db.generationJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', output: output as any, completedAt: new Date() }
      });
    } catch (e: any) {
      await db.generationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: { message: e.message }, completedAt: new Date() }
      });
      throw e;
    }
  }
}
