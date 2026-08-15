import { db } from '@ane/database';
import { LLMProvider } from '../architect/llm.js';
import { ProseStageHandler } from './handlers.js';
import { ProseContextBuilder } from './context.js';
import { ProviderFactory } from '../llm/factory.js';
import { ProseStatus } from '@prisma/client';
import { LLMUsageProxy } from '../generation/LLMUsageProxy.js';

export class ProseManager {
  private provider: LLMProvider;
  private handler: ProseStageHandler;

  constructor(provider?: LLMProvider) {
    this.provider = provider || ProviderFactory.getProvider('PROSE');
    this.handler = new ProseStageHandler(this.provider);
  }

  /**
   * Core prose generation logic.
   * NOTE: Job creation is NOT done here — it is the responsibility of DatabaseQueueManager.
   * This method only executes the domain operation for an already-existing job.
   *
   * @param novelId     - The novel being processed
   * @param chapterId   - The chapter being processed
   * @param scenePlanVersionId - The source ScenePlanVersion
   * @param previousSnapshotId - Optional continuity snapshot
   * @param jobId       - The existing GenerationJob ID (created by queue system)
   */
  async runProseGeneration(
    novelId: string,
    chapterId: string,
    scenePlanVersionId: string,
    previousSnapshotId: string | null,
    jobId?: string
  ): Promise<void> {
    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.novelId !== novelId) throw new Error('Chapter does not belong to the given novel');

    const scenePlanVersion = await db.scenePlanVersion.findUnique({
      where: { id: scenePlanVersionId },
      include: { scenes: { orderBy: { sceneNumber: 'asc' } } }
    });

    if (!scenePlanVersion) throw new Error('ScenePlanVersion not found');

    // LINEAGE VALIDATION: ScenePlanVersion must belong to this chapter
    if (scenePlanVersion.chapterId !== chapterId) {
      throw new Error(
        `Cross-version contamination rejected: ScenePlanVersion ${scenePlanVersionId} belongs to chapter ${scenePlanVersion.chapterId}, not ${chapterId}`
      );
    }

    // Wrap provider with usage proxy if we have a jobId
    const originalProvider = this.handler.provider;
    if (jobId) {
      this.handler.provider = new LLMUsageProxy(
        originalProvider,
        originalProvider.getProviderName(),
        novelId,
        'PROSE_GENERATION',
        chapterId,
        jobId
      ) as any;
    }

    try {
      const generatedScenes: any[] = [];

      const maxRevisions = parseInt(process.env.MAX_REVISION_RETRIES || '3', 10);

      for (const scene of scenePlanVersion.scenes) {
        // CROSS-VERSION PROTECTION: Each scene must belong to this exact ScenePlanVersion
        if (scene.scenePlanVersionId !== scenePlanVersionId) {
          throw new Error(
            `Cross-version contamination rejected: Scene ${scene.id} belongs to ScenePlanVersion ${scene.scenePlanVersionId}, not ${scenePlanVersionId}`
          );
        }

        const context = await ProseContextBuilder.buildContext(
          novelId,
          chapterId,
          scene.id,
          previousSnapshotId
        );

        const result = await this.handler.invokeWithRetries(context, scene, maxRevisions);
        generatedScenes.push({
          sceneId: scene.id,
          content: result.content,
          wordCount: result.wordCount,
          validationReport: result.validationReport,
          status: result.validationReport.passed ? ProseStatus.DRAFT : ProseStatus.REJECTED,
        });
      }

      // Transactional canonical promotion
      await db.$transaction(async (tx) => {
        // Fetch or create ChapterProse
        let chapterProse = await tx.chapterProse.findUnique({ where: { chapterId } });
        if (!chapterProse) {
          chapterProse = await tx.chapterProse.create({ data: { chapterId } });
        }

        const oldVersion = await tx.chapterProseVersion.findFirst({
          where: { chapterProseId: chapterProse.id, status: ProseStatus.CANONICAL }
        });

        const newVersionNum = oldVersion ? oldVersion.version + 1 : 1;

        // Create new version — starts as CANONICAL immediately (atomic swap below)
        const newVersion = await tx.chapterProseVersion.create({
          data: {
            chapterProseId: chapterProse.id,
            sourceScenePlanVersionId: scenePlanVersionId,
            version: newVersionNum,
            status: ProseStatus.CANONICAL,
            provider: originalProvider.getProviderName(),
          }
        });

        for (const gen of generatedScenes) {
          await tx.sceneProse.create({
            data: {
              chapterProseVersionId: newVersion.id,
              scenePlanId: gen.sceneId,
              content: gen.content,
              wordCount: gen.wordCount,
              status: ProseStatus.CANONICAL,
              validationReport: gen.validationReport as any,
            }
          });
        }

        // Mark old canonical version as STALE — never delete historical records
        if (oldVersion) {
          await tx.chapterProseVersion.update({
            where: { id: oldVersion.id },
            data: { status: ProseStatus.STALE }
          });
          await tx.sceneProse.updateMany({
            where: { chapterProseVersionId: oldVersion.id },
            data: { status: ProseStatus.STALE }
          });
        }

        // Update canonical pointer — only ever points to CANONICAL version
        await tx.chapterProse.update({
          where: { id: chapterProse.id },
          data: { currentVersionId: newVersion.id }
        });
      });
    } finally {
      // Always restore original provider — even if generation failed
      this.handler.provider = originalProvider;
    }
  }
}
