import { db } from '@ane/database';
import { StoryPlanningJobPayload } from '@ane/core';
import { LongHorizonPlanner } from './LongHorizonPlanner.js';
import { ChapterObjectivePlanner } from './ChapterObjectivePlanner.js';
import { PlanReconciler } from './PlanReconciler.js';
import { PlanningWindowBuilder } from './PlanningWindowBuilder.js';
import { PlanningValidator } from './PlanningValidator.js';
import { PlanningQualityScorer } from './NarrativeAnalyzers.js';
import { ObservabilityManager } from '../generation/ObservabilityManager.js';

const obs = ObservabilityManager.getInstance();

/**
 * StoryPlanningHandler
 *
 * Executes STORY_PLANNING jobs via existing ServerlessJobProcessor/JobDispatcher.
 * Routes to sub-operations:
 *   - initial: create initial LongHorizonPlan
 *   - arc_plan: plan a specific arc in detail
 *   - chapter_objectives: plan next chapter objectives
 *   - replan: adaptive replanning after major deviation
 *   - reconcile: post-chapter reconciliation
 *   - milestone_recovery: recover missed milestones
 *
 * Does NOT use a second queue. Uses existing DatabaseQueueManager conventions.
 */
export class StoryPlanningHandler {
  private planner = new LongHorizonPlanner();
  private objPlanner = new ChapterObjectivePlanner();
  private reconciler = new PlanReconciler();
  private windowBuilder = new PlanningWindowBuilder();

  async handle(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    const { novelId, operation } = payload;

    obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'planning.started', operation },
    });

    switch (operation) {
      case 'initial':
        return this.handleInitial(payload);
      case 'arc_plan':
        return this.handleArcPlan(payload);
      case 'chapter_objectives':
        return this.handleChapterObjectives(payload);
      case 'replan':
        return this.handleReplan(payload);
      case 'reconcile':
        return this.handleReconcile(payload);
      case 'milestone_recovery':
        return this.handleMilestoneRecovery(payload);
      default:
        throw new Error(`Unknown STORY_PLANNING operation: ${operation}`);
    }
  }

  // ====================================================================
  // Sub-operations
  // ====================================================================

  private async handleInitial(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    const novel = await db.novel.findUnique({ where: { id: payload.novelId } });
    if (!novel) throw new Error(`Novel ${payload.novelId} not found`);

    // Find the canonical StoryPlanVersion to link
    const storyPlan = await db.storyPlan.findUnique({ where: { novelId: payload.novelId } });
    const canonicalVersion = storyPlan
      ? await db.storyPlanVersion.findFirst({
          where: { planId: storyPlan.id, isCanonical: true },
          orderBy: { version: 'desc' },
        })
      : null;

    if (!canonicalVersion) {
      throw new Error('No canonical StoryPlanVersion found — Phase 3 planning must complete first');
    }

    const { planId, validation } = await this.planner.createInitialPlan(
      payload.novelId,
      canonicalVersion.id,
      {
        title: novel.title,
        premise: novel.premise ?? novel.title,
        genre: novel.genre ?? undefined,
        targetChapters: novel.targetChapters ?? 100,
        jobId: undefined,
      }
    );

    obs.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId: payload.novelId,
      timestamp: new Date(),
      metadata: { event: 'planning.completed', operation: 'initial', planId },
    });

    return {
      outcome: validation.valid ? 'PLAN_CREATED' : 'PLAN_CREATED_WITH_WARNINGS',
      details: { planId, validationErrors: validation.errors, validationWarnings: validation.warnings },
    };
  }

  private async handleArcPlan(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    if (!payload.longHorizonPlanId) throw new Error('longHorizonPlanId required for arc_plan');

    const arcs = await db.storyArcPlan.findMany({
      where: { longHorizonPlanId: payload.longHorizonPlanId },
    });

    const arcDomains = arcs.map((a) => ({
      id: a.id,
      longHorizonPlanId: a.longHorizonPlanId,
      novelId: a.novelId,
      arcNumber: a.arcNumber,
      title: a.title,
      purpose: a.purpose,
      objective: a.objective,
      conflict: a.conflict,
      stakes: a.stakes,
      entryConditions: a.entryConditions as string[],
      exitConditions: a.exitConditions as string[],
      plannedChapterStart: a.plannedChapterStart,
      plannedChapterEnd: a.plannedChapterEnd,
      status: a.status as any,
      priority: a.priority,
      allowExtension: a.allowExtension,
      maxExtensionChapters: a.maxExtensionChapters,
      characterFocusIds: a.characterFocusIds as string[],
      threadFocusIds: a.threadFocusIds as string[],
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    const validation = PlanningValidator.validateArcs(arcDomains);

    return {
      outcome: validation.valid ? 'ARC_PLAN_VALID' : 'ARC_PLAN_INVALID',
      details: { arcCount: arcs.length, errors: validation.errors, warnings: validation.warnings },
    };
  }

  private async handleChapterObjectives(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    if (!payload.chapterNumber || !payload.longHorizonPlanId) {
      throw new Error('chapterNumber and longHorizonPlanId required for chapter_objectives');
    }

    // Build planning window
    const window = await this.windowBuilder.build(
      payload.novelId,
      payload.chapterNumber,
      payload.longHorizonPlanId
    );

    // Plan objective
    const objective = await this.objPlanner.planObjective(
      payload.novelId,
      payload.chapterNumber,
      {
        longHorizonPlanId: payload.longHorizonPlanId,
        arcPlan: window.activeArcPlan,
        upcomingMilestones: window.upcomingMilestones,
        openObligations: window.openObligations,
        pendingForeshadowing: window.pendingForeshadowing,
        characterArcs: window.activeCharacterArcs,
        activeThreadTitles: window.activeThreadTitles,
        qualityTrend: window.qualityTrend,
      }
    );

    return {
      outcome: objective ? 'OBJECTIVE_PLANNED' : 'NO_PLAN_EXISTS',
      details: { objectiveId: objective?.id, chapterNumber: payload.chapterNumber },
    };
  }

  private async handleReplan(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    if (!payload.longHorizonPlanId || !payload.chapterNumber) {
      throw new Error('longHorizonPlanId and chapterNumber required for replan');
    }

    const result = await this.planner.replan(
      payload.novelId,
      payload.chapterNumber,
      {
        longHorizonPlanId: payload.longHorizonPlanId,
        reason: 'Major deviation from planned objectives',
        jobId: undefined,
      }
    );

    return {
      outcome: result.success ? 'REPLANNING_COMPLETED' : 'REPLANNING_FAILED',
      details: { newArcIds: result.newArcIds },
    };
  }

  private async handleReconcile(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    if (!payload.chapterNumber || !payload.longHorizonPlanId || !payload.chapterObjectiveId) {
      throw new Error('chapterNumber, longHorizonPlanId, chapterObjectiveId required for reconcile');
    }

    // Load actual key events from chapter memory
    const memory = await db.chapterMemoryRecord.findFirst({
      where: { novelId: payload.novelId, chapterNumber: payload.chapterNumber },
    });

    const actualKeyEvents = (memory?.keyEvents as string[]) ?? [];

    const result = await this.reconciler.reconcile(
      payload.novelId,
      payload.chapterNumber,
      {
        longHorizonPlanId: payload.longHorizonPlanId,
        chapterObjectiveId: payload.chapterObjectiveId,
        actualKeyEvents,
        actualStateDeltas: (memory?.stateDeltas as any[]) ?? [],
      }
    );

    return {
      outcome: `RECONCILED_${result.deviationType}`,
      details: {
        deviationType: result.deviationType,
        completionScore: result.objectiveCompletionScore,
        requiresReplanning: result.requiresReplanning,
      },
    };
  }

  private async handleMilestoneRecovery(payload: StoryPlanningJobPayload): Promise<{ outcome: string; details: any }> {
    if (!payload.longHorizonPlanId) throw new Error('longHorizonPlanId required');

    const novel = await db.novel.findUnique({
      where: { id: payload.novelId },
      select: { lastCanonicalChapter: true },
    });

    const currentChapter = novel?.lastCanonicalChapter ?? 0;

    // Find milestones that missed their window
    const missed = await db.narrativeMilestoneRecord.findMany({
      where: {
        novelId: payload.novelId,
        status: 'PLANNED',
        plannedChapterMax: { lt: currentChapter },
        isOptional: false,
      },
    });

    let recovered = 0;
    for (const ms of missed) {
      // Extend window by 20% of arc length or 15 chapters
      const extensionChapters = 15;
      await db.narrativeMilestoneRecord.update({
        where: { id: ms.id },
        data: {
          plannedChapterMax: currentChapter + extensionChapters,
          status: 'AVAILABLE',
        },
      }).catch(() => {});
      recovered++;
    }

    return {
      outcome: 'MILESTONE_RECOVERY_COMPLETE',
      details: { recovered, currentChapter },
    };
  }
}
