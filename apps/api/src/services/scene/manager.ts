import { db } from '@ane/database';
import { LLMProvider } from '../architect/llm.js';
import { ProviderFactory } from '../llm/factory.js';
import { SceneStageHandler } from './handlers.js';
import { ContinuityValidator } from './validator.js';
import { LLMUsageProxy } from '../generation/LLMUsageProxy.js';

export class SceneManager {
  private provider: LLMProvider;
  private handler: SceneStageHandler;

  constructor(provider?: LLMProvider) {
    this.provider = provider || ProviderFactory.getProvider('SCENE');
    this.handler = new SceneStageHandler(this.provider);
  }

  /**
   * Execute scene plan generation for a chapter.
   * NOTE: GenerationJob must already exist (created by DatabaseQueueManager).
   * This method executes the domain work. Job status updates are owned by ServerlessJobProcessor.
   *
   * @param novelId           - The novel being processed
   * @param chapterId         - The chapter to generate scenes for
   * @param previousSnapshotId - Optional ID of previous continuity snapshot
   * @param jobId             - Optional existing GenerationJob ID for usage tracking
   */
  async runStage(
    novelId: string,
    chapterId: string,
    previousSnapshotId?: string,
    jobId?: string
  ): Promise<void> {
    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.novelId !== novelId) throw new Error('Chapter does not belong to the given novel');

    // Concurrency guard — defend in depth against double-processing
    const runningJob = await db.generationJob.findFirst({
      where: {
        novelId,
        sceneStage: 'SCENE_PLAN',
        status: { in: ['RUNNING', 'CLAIMED'] },
        id: { not: jobId ?? '' }
      }
    });
    if (runningJob) {
      throw new Error(`Scene plan generation already in progress for novel ${novelId}: job ${runningJob.id}`);
    }

    const originalProvider = this.handler.provider;

    // Wrap with usage proxy if we have a jobId
    if (jobId) {
      this.handler.provider = new LLMUsageProxy(
        originalProvider,
        originalProvider.getProviderName(),
        novelId,
        'SCENE_PLAN',
        chapterId,
        jobId
      ) as any;
    }

    try {
      // 1. Generate candidate
      const prompt = await this.handler.prepareInput(novelId, chapterId, previousSnapshotId);
      const fullPrompt = `${prompt}\nSTAGE: SCENE_PLAN`;
      const output = await this.handler.invoke(fullPrompt);

      // 2. Fetch before state (previous snapshot)
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

      // 3. Compute continuity after-state
      const allStateChanges = output.scenes.flatMap((s: any) => s.stateChanges);
      const afterState = ContinuityValidator.computeAfterState(beforeState, allStateChanges as any[]);

      // 4. Transactional canonical promotion — old versions become STALE, never deleted
      await db.$transaction(async (tx) => {
        const oldCanonical = await tx.scenePlanVersion.findFirst({
          where: { chapterId, status: 'CANONICAL' }
        });

        if (oldCanonical) {
          // Mark old version and its scenes STALE — do NOT delete
          await tx.scenePlanVersion.update({
            where: { id: oldCanonical.id },
            data: { status: 'STALE' }
          });
          await tx.scene.updateMany({
            where: { scenePlanVersionId: oldCanonical.id },
            data: { status: 'STALE' }
          });
          // Note: continuity snapshot attached to old version remains immutable
        }

        const newVersionNum = oldCanonical ? oldCanonical.version + 1 : 1;
        const newVersionId = await this.handler.applyCanonicalPersistence(
          chapterId,
          output,
          tx,
          newVersionNum
        );

        // 5. Create continuity snapshot for the new version
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
    } finally {
      // Always restore original provider — even if generation failed
      this.handler.provider = originalProvider;
    }
  }
}
