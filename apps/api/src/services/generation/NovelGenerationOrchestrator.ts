import { db } from '@ane/database';
import { randomUUID } from 'node:crypto';
import {
  NovelGenerationState,
  GenerationStageType,
  NovelGenerationConfig,
  NovelGenerationConfigSchema,
  GenerationStatus,
  GenerationProgress,
  GenerationStageResult,
} from '@ane/core';
import { JobType, PlannerStage, ArchitectStage } from '@ane/core';
import { GenerationStageResolver } from './GenerationStageResolver.js';
import { BudgetManager } from './BudgetManager.js';

/**
 * NovelGenerationOrchestrator
 *
 * Top-level autonomous generation coordinator.
 *
 * RESPONSIBILITIES:
 * - Inspect current novel state
 * - Ask GenerationStageResolver for next work
 * - Create GenerationJob records via db.generationJob (through DatabaseQueueManager semantics)
 * - Enforce idempotency (no duplicate jobs via idempotencyKey @unique)
 * - Enforce concurrency, window, and budget limits
 * - Manage pause/resume/cancel lifecycle
 *
 * THIS SERVICE:
 * - NEVER calls LLM providers
 * - NEVER calls ILLMProvider
 * - NEVER executes prose/scene/architect directly
 * - ONLY creates GenerationJob records
 */
export class NovelGenerationOrchestrator {
  private resolver = new GenerationStageResolver();
  private budgetManager = BudgetManager.getInstance();

  // ====================================================================
  // START
  // ====================================================================

  async start(novelId: string, config?: Partial<NovelGenerationConfig>): Promise<GenerationStatus> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    // Merge and validate config
    const mergedConfig = NovelGenerationConfigSchema.parse({
      autoContinue: config?.autoContinue ?? novel.autoContinue,
      autoGenerateScenes: config?.autoGenerateScenes ?? novel.autoGenerateScenes,
      autoGenerateProse: config?.autoGenerateProse ?? novel.autoGenerateProse,
      maxConcurrentJobs: config?.maxConcurrentJobs ?? novel.maxConcurrentJobs,
      chapterBatchSize: config?.chapterBatchSize ?? novel.chapterBatchSize,
      generationWindowSize: config?.generationWindowSize ?? novel.generationWindowSize,
      maxGenerationCostUsd:
        config?.maxGenerationCostUsd ?? novel.maxGenerationCostUsd ?? undefined,
    });

    // Generate a new correlationId if one doesn't exist
    const correlationId = novel.correlationId ?? `gen-${randomUUID()}`;

    // Idempotent: skip transition if already actively generating
    const isAlreadyActive = (
      [
        NovelGenerationState.ARCHITECTING,
        NovelGenerationState.PLANNING,
        NovelGenerationState.GENERATING_CHAPTERS,
        NovelGenerationState.GENERATING_SCENES,
        NovelGenerationState.GENERATING_PROSE,
      ] as string[]
    ).includes(novel.generationState);

    if (!isAlreadyActive) {
      await db.novel.update({
        where: { id: novelId },
        data: {
          generationState: NovelGenerationState.INITIALIZING,
          autoContinue: mergedConfig.autoContinue,
          autoGenerateScenes: mergedConfig.autoGenerateScenes,
          autoGenerateProse: mergedConfig.autoGenerateProse,
          maxConcurrentJobs: mergedConfig.maxConcurrentJobs,
          chapterBatchSize: mergedConfig.chapterBatchSize,
          generationWindowSize: mergedConfig.generationWindowSize,
          maxGenerationCostUsd: mergedConfig.maxGenerationCostUsd ?? null,
          correlationId,
        },
      });
    }

    // Advance to enqueue the first work
    await this.advance(novelId);

    return this.getStatus(novelId);
  }

  // ====================================================================
  // ADVANCE
  // ====================================================================

  async advance(novelId: string): Promise<void> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    // Guard: paused/completed/failed — do nothing
    const pausedOrTerminal = (
      [
        NovelGenerationState.PAUSED,
        NovelGenerationState.COMPLETED,
        NovelGenerationState.FAILED,
      ] as string[]
    ).includes(novel.generationState);

    if (pausedOrTerminal) return;

    // Guard: budget exceeded
    if (novel.maxGenerationCostUsd) {
      const totalCostResult = await db.generationJob.aggregate({
        where: { novelId, status: 'SUCCEEDED' },
        _sum: { estimatedCostUsd: true },
      });
      const spent = totalCostResult._sum.estimatedCostUsd ?? 0;
      if (spent >= novel.maxGenerationCostUsd) {
        await db.novel.update({
          where: { id: novelId },
          data: { generationState: NovelGenerationState.BLOCKED },
        });
        return;
      }
    }

    // Guard: concurrency limit
    const activeJobCount = await db.generationJob.count({
      where: {
        novelId,
        status: { in: ['CLAIMED', 'RUNNING'] },
      },
    });
    if (activeJobCount >= novel.maxConcurrentJobs) {
      return;
    }

    // Resolve next stage
    const resolution = await this.resolver.resolve(novelId);

    if (resolution.stage === GenerationStageType.COMPLETED) {
      await db.novel.update({
        where: { id: novelId },
        data: { generationState: NovelGenerationState.COMPLETED },
      });
      return;
    }

    if (resolution.stage === GenerationStageType.BLOCKED || !resolution.ready) {
      await db.novel.update({
        where: { id: novelId },
        data: { generationState: NovelGenerationState.BLOCKED },
      });
      return;
    }

    // Enqueue the next job
    await this.enqueueForStage(
      novelId,
      resolution.stage,
      resolution.context,
      novel.correlationId ?? undefined
    );

    // Update novel state to reflect current stage
    const newState = this.stageToNovelState(resolution.stage);
    if (newState !== novel.generationState) {
      await db.novel.update({
        where: { id: novelId },
        data: { generationState: newState },
      });
    }
  }

  // ====================================================================
  // PAUSE
  // ====================================================================

  async pause(novelId: string): Promise<void> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    await db.novel.update({
      where: { id: novelId },
      data: {
        generationState: NovelGenerationState.PAUSED,
        autoContinue: false,
      },
    });

    // Cancel QUEUED jobs (not yet claimed) — non-destructive
    await db.generationJob.updateMany({
      where: { novelId, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });
  }

  // ====================================================================
  // RESUME
  // ====================================================================

  async resume(novelId: string): Promise<void> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);
    if (novel.generationState !== NovelGenerationState.PAUSED) {
      throw new Error(`Novel is not paused (current state: ${novel.generationState})`);
    }

    await db.novel.update({
      where: { id: novelId },
      data: { generationState: NovelGenerationState.INITIALIZING },
    });

    await this.advance(novelId);
  }

  // ====================================================================
  // CANCEL
  // ====================================================================

  async cancel(novelId: string): Promise<{ cancelled: number }> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    // Only cancel QUEUED — never touch CLAIMED/RUNNING/historical artifacts
    const result = await db.generationJob.updateMany({
      where: { novelId, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });

    await db.novel.update({
      where: { id: novelId },
      data: { generationState: NovelGenerationState.PAUSED },
    });

    return { cancelled: result.count };
  }

  // ====================================================================
  // RETRY FAILED
  // ====================================================================

  async retryFailed(novelId: string): Promise<{ retried: number }> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    const maxRetries = parseInt(process.env.MAX_RETRIES ?? '3', 10);

    const failedJobs = await db.generationJob.findMany({
      where: {
        novelId,
        status: 'FAILED',
        retryCount: { lt: maxRetries },
      },
    });

    let retried = 0;
    for (const job of failedJobs) {
      await db.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'QUEUED',
          retryCount: job.retryCount + 1,
          lockedAt: null,
          lockedBy: null,
          failedAt: null,
          scheduledAt: new Date(),
          // Clear idempotency key so a fresh job can be created if needed
          idempotencyKey: null,
        },
      });
      retried++;
    }

    if (
      retried > 0 &&
      (
        [NovelGenerationState.BLOCKED, NovelGenerationState.FAILED] as string[]
      ).includes(novel.generationState)
    ) {
      await db.novel.update({
        where: { id: novelId },
        data: { generationState: NovelGenerationState.INITIALIZING },
      });
    }

    return { retried };
  }

  // ====================================================================
  // GET STATUS
  // ====================================================================

  async getStatus(novelId: string): Promise<GenerationStatus> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    const jobCounts = await db.generationJob.groupBy({
      by: ['status'],
      where: { novelId },
      _count: { status: true },
    });

    const countByStatus: Record<string, number> = Object.fromEntries(
      jobCounts.map((g) => [g.status, g._count.status])
    );

    const usageTotals = await db.generationJob.aggregate({
      where: { novelId, status: 'SUCCEEDED' },
      _sum: {
        estimatedCostUsd: true,
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
      },
    });

    const estimatedTotalCostUsd = usageTotals._sum.estimatedCostUsd ?? 0;
    const maxBudget = novel.maxGenerationCostUsd ?? undefined;

    const completedChapters = await db.chapter.count({
      where: {
        novelId,
        chapterProse: {
          versions: { some: { status: 'CANONICAL' } },
        },
      },
    });

    const resolution = await this.resolver.resolve(novelId);

    return {
      novelId,
      state: novel.generationState as NovelGenerationState,
      autoContinue: novel.autoContinue,
      targetChapters: novel.targetChapters,
      completedChapters,
      currentChapter: null,
      progressPercent: novel.targetChapters
        ? Math.round((completedChapters / novel.targetChapters) * 100 * 10) / 10
        : 0,
      activeJobs: (countByStatus['CLAIMED'] ?? 0) + (countByStatus['RUNNING'] ?? 0),
      queuedJobs: countByStatus['QUEUED'] ?? 0,
      failedJobs: countByStatus['FAILED'] ?? 0,
      retryPendingJobs: countByStatus['RETRY_PENDING'] ?? 0,
      currentStage:
        resolution.stage !== GenerationStageType.BLOCKED ? resolution.stage : null,
      budget: {
        maxGenerationCostUsd: maxBudget,
        estimatedTotalCostUsd,
        totalInputTokens: usageTotals._sum.inputTokens ?? 0,
        totalOutputTokens: usageTotals._sum.outputTokens ?? 0,
        totalTokens: usageTotals._sum.totalTokens ?? 0,
        remainingBudgetUsd:
          maxBudget !== undefined ? Math.max(0, maxBudget - estimatedTotalCostUsd) : undefined,
      },
      correlationId: novel.correlationId,
      blockers: resolution.blockers,
    };
  }

  // ====================================================================
  // GET PROGRESS
  // ====================================================================

  async getProgress(novelId: string): Promise<GenerationProgress> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new Error(`Novel ${novelId} not found`);

    const chapters = await db.chapter.findMany({
      where: { novelId },
      orderBy: { number: 'asc' },
      include: {
        chapterBlueprint: true,
        scenePlanVersions: {
          where: { status: 'CANONICAL' },
          take: 1,
        },
        chapterProse: {
          include: {
            versions: {
              where: { status: 'CANONICAL' },
              take: 1,
            },
          },
        },
      },
    });

    const plannedChapters = chapters.filter((c) => c.chapterBlueprint !== null).length;
    const scenePlannedChapters = chapters.filter((c) => c.scenePlanVersions.length > 0).length;
    const proseCompletedChapters = chapters.filter(
      (c) => c.chapterProse?.versions && c.chapterProse.versions.length > 0
    ).length;

    const targetChapters = novel.targetChapters;
    const windowStart = proseCompletedChapters + 1;
    const windowEnd = targetChapters
      ? Math.min(
          windowStart +
            (novel.generationWindowSize ?? 2) * (novel.chapterBatchSize ?? 10) -
            1,
          targetChapters
        )
      : windowStart + (novel.chapterBatchSize ?? 10) - 1;

    return {
      targetChapters,
      completedChapters: proseCompletedChapters,
      plannedChapters,
      scenePlannedChapters,
      proseCompletedChapters,
      currentWindow:
        targetChapters && windowStart <= targetChapters
          ? { start: windowStart, end: windowEnd }
          : null,
      percent: targetChapters
        ? Math.round((proseCompletedChapters / targetChapters) * 100 * 10) / 10
        : 0,
    };
  }

  // ====================================================================
  // Private Helpers
  // ====================================================================

  private async enqueueForStage(
    novelId: string,
    stage: GenerationStageType,
    context: GenerationStageResult['context'],
    correlationId?: string
  ): Promise<void> {
    const idempotencyKey = GenerationStageResolver.buildIdempotencyKey(novelId, stage, context);

    // Check for existing active job with same idempotency key (application-level guard)
    const existingJob = await db.generationJob.findFirst({
      where: {
        idempotencyKey,
        status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_PENDING'] },
      },
    });

    if (existingJob) return; // Idempotent skip

    const { jobType, payload } = this.buildJobPayload(novelId, stage, context);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.generationJob.create as any)({
        data: {
          novelId,
          status: 'QUEUED',
          provider: process.env.LLM_PROVIDER ?? 'mock',
          idempotencyKey,
          correlationId: correlationId ?? null,
          stage: jobType === JobType.ARCHITECT_STAGE ? (payload.stage as string) : undefined,
          plannerStage: jobType === JobType.PLANNER_STAGE ? (payload.stage as string) : undefined,
          sceneStage: jobType === JobType.SCENE_GENERATION ? 'SCENE_PLAN' : undefined,
          proseStage: jobType === JobType.PROSE_GENERATION ? 'PROSE' : undefined,
          input: payload,
          maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),
        },
      });
    } catch (err: any) {
      // DB-level unique constraint violation: another concurrent orchestrator won the race
      if (err.code === 'P2002') {
        return; // Idempotent — silent skip
      }
      throw err;
    }
  }

  private buildJobPayload(
    novelId: string,
    stage: GenerationStageType,
    context: GenerationStageResult['context'] = {}
  ): { jobType: JobType; payload: Record<string, unknown> } {
    switch (stage) {
      case GenerationStageType.ARCHITECT:
        return {
          jobType: JobType.ARCHITECT_STAGE,
          payload: {
            novelId,
            type: JobType.ARCHITECT_STAGE,
            stage: ArchitectStage.STORY_BIBLE_FINALIZATION,
          },
        };

      case GenerationStageType.PLANNER_DESTINATION:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: { novelId, type: JobType.PLANNER_STAGE, stage: PlannerStage.DESTINATION },
        };

      case GenerationStageType.PLANNER_MACRO:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: { novelId, type: JobType.PLANNER_STAGE, stage: PlannerStage.MACRO },
        };

      case GenerationStageType.PLANNER_SAGA:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: { novelId, type: JobType.PLANNER_STAGE, stage: PlannerStage.SAGA },
        };

      case GenerationStageType.PLANNER_ARC:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: {
            novelId,
            type: JobType.PLANNER_STAGE,
            stage: PlannerStage.ARC,
            parentId: context?.sagaId,
          },
        };

      case GenerationStageType.PLANNER_MINI_ARC:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: {
            novelId,
            type: JobType.PLANNER_STAGE,
            stage: PlannerStage.MINI_ARC,
            parentId: context?.arcId,
          },
        };

      case GenerationStageType.CHAPTER_BLUEPRINT:
        return {
          jobType: JobType.PLANNER_STAGE,
          payload: {
            novelId,
            type: JobType.PLANNER_STAGE,
            stage: PlannerStage.CHAPTER_BATCH,
            chapterStart: context?.chapterStart ?? 1,
            chapterEnd: context?.chapterEnd ?? 10,
          },
        };

      case GenerationStageType.SCENE_PLAN:
        return {
          jobType: JobType.SCENE_GENERATION,
          payload: {
            novelId,
            type: JobType.SCENE_GENERATION,
            chapterId: context?.chapterId ?? '',
          },
        };

      case GenerationStageType.PROSE:
        return {
          jobType: JobType.PROSE_GENERATION,
          payload: {
            novelId,
            type: JobType.PROSE_GENERATION,
            chapterId: context?.chapterId ?? '',
            // scenePlanVersionId resolved at execution time by ProseManager
            scenePlanVersionId: '',
          },
        };

      default:
        throw new Error(`Unknown stage for job creation: ${stage}`);
    }
  }

  private stageToNovelState(stage: GenerationStageType): NovelGenerationState {
    switch (stage) {
      case GenerationStageType.ARCHITECT:
        return NovelGenerationState.ARCHITECTING;
      case GenerationStageType.PLANNER_DESTINATION:
      case GenerationStageType.PLANNER_MACRO:
      case GenerationStageType.PLANNER_SAGA:
      case GenerationStageType.PLANNER_ARC:
      case GenerationStageType.PLANNER_MINI_ARC:
        return NovelGenerationState.PLANNING;
      case GenerationStageType.CHAPTER_BLUEPRINT:
        return NovelGenerationState.GENERATING_CHAPTERS;
      case GenerationStageType.SCENE_PLAN:
        return NovelGenerationState.GENERATING_SCENES;
      case GenerationStageType.PROSE:
        return NovelGenerationState.GENERATING_PROSE;
      case GenerationStageType.COMPLETED:
        return NovelGenerationState.COMPLETED;
      default:
        return NovelGenerationState.BLOCKED;
    }
  }
}
