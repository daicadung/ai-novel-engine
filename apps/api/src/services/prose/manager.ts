import { db } from '@ane/database';
import { LLMProvider } from '../architect/llm.js';
import { ProseStageHandler } from './handlers.js';
import { ProseContextBuilder } from './context.js';
import { ProviderFactory } from '../llm/factory.js';
import { ProseStatus, JobType } from '@ane/core';
import { LLMUsageProxy } from '../generation/LLMUsageProxy.js';
import { ChapterMemoryManager } from '../continuity/ChapterMemoryManager.js';
import { DatabaseQueueManager } from '../queue/DatabaseQueueManager.js';
import { GenerationQualityGate } from '../continuity/GenerationQualityGate.js';
import { PlotThreadManager } from '../continuity/PlotThreadManager.js';
import { QualityOrchestrator } from '../quality/QualityOrchestrator.js';

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
   * Phase 9 additions:
   * - Runs GenerationQualityGate before canonical promotion
   * - Creates ChapterMemory after successful promotion
   * - Promotes StoryState with extracted deltas
   * - Handles BLOCK recommendation (throws, causing job to become RETRY_PENDING/BLOCKED)
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
      const allProseText: string[] = [];

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
        allProseText.push(result.content);
        generatedScenes.push({
          sceneId: scene.id,
          content: result.content,
          wordCount: result.wordCount,
          validationReport: result.validationReport,
          status: result.validationReport.passed ? ProseStatus.DRAFT : ProseStatus.REJECTED,
        });
      }

      // ----------------------------------------------------------------
      // Phase 9: Extract state deltas from canonical scene plan
      // ----------------------------------------------------------------
      const stateDeltas = await ChapterMemoryManager.extractStateDeltas(chapterId);

      // ----------------------------------------------------------------
      // Phase 9: Run quality gate BEFORE canonical promotion
      // ----------------------------------------------------------------
      let newVersionId: string | null = null;

      // Transactional canonical promotion (unchanged from before)
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

        newVersionId = newVersion.id;

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

      // ----------------------------------------------------------------
      // Phase 9: Quality gate (runs AFTER write, before state promotion)
      // Non-blocking in WARN mode — blocks in FAIL mode
      // ----------------------------------------------------------------
      if (newVersionId) {
        const gateReport = await GenerationQualityGate.runGate(
          novelId,
          chapterId,
          newVersionId,
          {
            proposedDeltas: stateDeltas,
            proseText: allProseText.join('\n'),
            chapterNumber: chapter.number,
          }
        );

        if (gateReport.recommendation === 'BLOCK') {
          // Mark the prose version as STALE (it's been written but blocked from being current)
          await db.chapterProseVersion.update({
            where: { id: newVersionId },
            data: { status: ProseStatus.STALE }
          });
          await db.chapterProse.update({
            where: { chapterId },
            data: { currentVersionId: null }
          });
          throw new Error(
            `Quality gate BLOCKED promotion for chapter ${chapter.number}: ${gateReport.conflicts
              .filter((c) => c.severity === 'ERROR')
              .map((c) => c.description)
              .join('; ')}`
          );
        }
        // WARN or PASS: continue to state promotion
      }

      // ----------------------------------------------------------------
      // Phase 9: Promote StoryState with chapter's deltas
      // ----------------------------------------------------------------
      if (stateDeltas.length > 0) {
        await ChapterMemoryManager.promoteStoryState(
          novelId,
          chapter.number,
          stateDeltas,
        ).catch((err) => {
          // Non-fatal — story state promotion failure should not block prose
          console.error('[ProseManager] Story state promotion failed:', err);
        });
      }

      // ----------------------------------------------------------------
      // Phase 9: Create chapter memory
      // ----------------------------------------------------------------
      await ChapterMemoryManager.createMemory(
        novelId,
        chapterId,
        chapter.number,
        stateDeltas,
        `Chapter ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''} — ${generatedScenes.length} scenes generated`,
        {
          locations: scenePlanVersion.scenes.map((s) => s.location).filter(Boolean) as string[],
          keyEvents: generatedScenes.slice(0, 10).map((_, i) => `Scene ${i + 1} completed`),
        }
      ).catch((err) => {
        // Non-fatal
        console.error('[ProseManager] Chapter memory creation failed:', err);
      });

      // ----------------------------------------------------------------
      // Phase 9: Update plot thread statuses from state deltas
      // ----------------------------------------------------------------
      await PlotThreadManager.updateFromDeltas(novelId, stateDeltas).catch(() => {});

      // ----------------------------------------------------------------
      // Phase 10: Quality analysis (non-fatal, fully async-safe)
      // Runs AFTER canonical promotion and all Phase 9 steps
      // NEVER modifies canonical state
      // ----------------------------------------------------------------
      const totalWordCount = generatedScenes.reduce(
        (acc, s) => acc + (s.wordCount ?? 0),
        0
      );
      const qualityOrchestrator = new QualityOrchestrator();
      await qualityOrchestrator.analyze(novelId, chapterId, chapter.number, {
        chapterProseVersionId: newVersionId ?? undefined,
        stateDeltas,
        wordCount: totalWordCount,
        sceneCount: generatedScenes.length,
        jobId,
      }).catch((err) => {
        // Non-fatal — quality analysis must never block canonical generation
        console.error('[ProseManager] Phase 10 quality analysis failed (non-fatal):', err);
      });

      // ----------------------------------------------------------------
      // Phase 12: Enqueue Causality Analysis (non-fatal, fully async-safe)
      // Runs AFTER canonical promotion
      // ----------------------------------------------------------------
      const queueManager = new DatabaseQueueManager();
      await queueManager.addJob(JobType.CAUSALITY_ANALYSIS, {
        novelId,
        chapterId,
        chapterNumber: chapter.number,
      }, {
        jobId: `causality-${chapterId}`, // Idempotent key
      }).catch((err) => {
        console.error('[ProseManager] Failed to enqueue causality analysis:', err);
      });

    } finally {
      // Always restore original provider — even if generation failed
      this.handler.provider = originalProvider;
    }
  }
}
