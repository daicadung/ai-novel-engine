import { db } from '@ane/database';
import {
  PlanReconciliationResult,
  ChapterObjective,
  DeviationType,
  MilestoneStatus,
  ObligationStatus,
  ArcCompletionResult,
  ArcStatus,
} from '@ane/core';
import { PlanningValidator } from './PlanningValidator.js';
import { ForeshadowingManager } from './ForeshadowingManager.js';
import { ObservabilityManager } from '../generation/ObservabilityManager.js';

const obs = ObservabilityManager.getInstance();

/**
 * PlanReconciler
 *
 * Post-chapter evaluation service.
 * Compares actual canonical outcomes against ChapterObjective.
 * Determines deviation type, updates milestone/obligation/foreshadowing state.
 * Decides if replanning is required.
 *
 * NEVER mutates canonical prose or canonical story state.
 */
export class PlanReconciler {
  private foreshadowingManager = new ForeshadowingManager();

  async reconcile(
    novelId: string,
    chapterNumber: number,
    opts: {
      longHorizonPlanId: string;
      chapterObjectiveId: string;
      actualKeyEvents: string[];
      actualStateDeltas: Array<{ entityType: string; entityId: string; property: string; newValue: string }>;
      wordCount?: number;
    }
  ): Promise<PlanReconciliationResult> {
    obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      chapterId: chapterNumber.toString(),
      timestamp: new Date(),
      metadata: { event: 'plan.reconciliation_started', chapterNumber },
    });

    // Load objective
    const objRecord = await db.chapterObjectiveRecord.findUnique({
      where: { id: opts.chapterObjectiveId },
    });

    if (!objRecord) {
      return this.buildEmptyResult(novelId, chapterNumber, opts.chapterObjectiveId, opts.longHorizonPlanId);
    }

    const requiredEvents = (objRecord.requiredEvents as string[]) ?? [];
    const forbiddenEvents = (objRecord.forbiddenEvents as string[]) ?? [];
    const actualEventsLower = opts.actualKeyEvents.map((e) => e.toLowerCase().trim());

    // ---- Check required events ----
    const completedRequiredEvents: string[] = [];
    const missedRequiredEvents: string[] = [];

    for (const req of requiredEvents) {
      const reqLower = req.toLowerCase();
      const delivered = actualEventsLower.some(
        (e) => e.includes(reqLower.split(' ').slice(0, 3).join(' '))
      );
      if (delivered) {
        completedRequiredEvents.push(req);
      } else {
        missedRequiredEvents.push(req);
      }
    }

    // ---- Check forbidden events ----
    const forbiddenEventsTriggered: string[] = [];
    for (const forbidden of forbiddenEvents) {
      const forbLower = forbidden.toLowerCase();
      const triggered = actualEventsLower.some(
        (e) => e.includes(forbLower.split(' ').slice(0, 3).join(' '))
      );
      if (triggered) {
        forbiddenEventsTriggered.push(forbidden);
      }
    }

    // ---- Objective completion score ----
    const objectiveCompletionScore = this.computeCompletionScore(
      completedRequiredEvents.length,
      missedRequiredEvents.length,
      forbiddenEventsTriggered.length,
      requiredEvents.length
    );

    // ---- Classify deviation ----
    const deviationType = PlanningValidator.classifyDeviation(
      objectiveCompletionScore,
      missedRequiredEvents.length,
      forbiddenEventsTriggered.length,
      requiredEvents.length
    );

    // ---- Update milestone state ----
    const { triggered: milestonesTriggered, invalidated: milestonesInvalidated } =
      await this.updateMilestones(novelId, chapterNumber, opts.actualKeyEvents, deviationType);

    // ---- Update obligations ----
    const { progressed: obligationsProgressed, satisfied: obligationsSatisfied } =
      await this.updateObligations(novelId, chapterNumber, opts.actualKeyEvents);

    // ---- Update foreshadowing ----
    const foreshadowingDelivered = await this.detectForeshadowingSetups(
      novelId, chapterNumber, opts.actualKeyEvents
    );
    const foreshadowingPaidOff = await this.detectForeshadowingPayoffs(
      novelId, chapterNumber, opts.actualKeyEvents
    );

    // Detect forgotten setups
    await this.foreshadowingManager.detectForgotten(novelId, chapterNumber);

    // ---- Determine if replanning required ----
    const requiresReplanning =
      deviationType === DeviationType.MAJOR_DEVIATION ||
      deviationType === DeviationType.PLAN_INVALID;

    const replanningReason = requiresReplanning
      ? `Chapter ${chapterNumber}: ${deviationType} — forbidden: [${forbiddenEventsTriggered.join('; ')}] missed: [${missedRequiredEvents.slice(0, 3).join('; ')}]`
      : undefined;

    // ---- Check arc completion ----
    await this.checkArcCompletion(novelId, chapterNumber, opts.longHorizonPlanId);

    // ---- Update objective status ----
    await db.chapterObjectiveRecord.update({
      where: { id: opts.chapterObjectiveId },
      data: {
        status: 'COMPLETED',
        completionScore: objectiveCompletionScore,
      },
    }).catch(() => {});

    // ---- Persist reconciliation ----
    const reconcId = `rec-${novelId.slice(-8)}-ch${chapterNumber}`;
    await db.planReconciliationRecord.upsert({
      where: { id: reconcId },
      create: {
        id: reconcId,
        novelId,
        chapterNumber,
        chapterObjectiveId: opts.chapterObjectiveId,
        longHorizonPlanId: opts.longHorizonPlanId,
        deviationType,
        objectiveCompletionScore,
        completedRequiredEvents,
        missedRequiredEvents,
        forbiddenEventsTriggered,
        milestonesTriggered,
        milestonesInvalidated,
        obligationsProgressed,
        obligationsSatisfied,
        foreshadowingDelivered,
        foreshadowingPaidOff,
        requiresReplanning,
        replanningReason: replanningReason ?? null,
      },
      update: {},
    });

    obs.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId,
      chapterId: chapterNumber.toString(),
      timestamp: new Date(),
      metadata: {
        event: 'plan.reconciliation_completed',
        chapterNumber,
        deviationType,
        objectiveCompletionScore,
        requiresReplanning,
      },
    });

    return {
      novelId,
      chapterNumber,
      chapterObjectiveId: opts.chapterObjectiveId,
      deviationType,
      objectiveCompletionScore,
      completedRequiredEvents,
      missedRequiredEvents,
      forbiddenEventsTriggered,
      milestonesTriggered,
      milestonesInvalidated,
      obligationsProgressed,
      obligationsSatisfied,
      foreshadowingDelivered,
      foreshadowingPaidOff,
      requiresReplanning,
      replanningReason,
      createdAt: new Date(),
    };
  }

  // ====================================================================
  // Arc completion evaluation
  // ====================================================================

  async evaluateArcCompletion(
    novelId: string,
    arcId: string,
    currentChapter: number
  ): Promise<ArcCompletionResult> {
    const arc = await db.storyArcPlan.findUnique({ where: { id: arcId } });
    if (!arc) return ArcCompletionResult.FAIL;

    const exitConditions = (arc.exitConditions as string[]) ?? [];

    // Check milestones associated with this arc
    const arcMilestones = await db.narrativeMilestoneRecord.findMany({
      where: { arcPlanId: arcId, isOptional: false },
    });

    const completedMilestones = arcMilestones.filter(
      (m) => m.status === MilestoneStatus.COMPLETED
    );
    const milestoneCompletionRate =
      arcMilestones.length > 0
        ? completedMilestones.length / arcMilestones.length
        : 1.0;

    // Check if chapter range exceeded
    const isOverExtension =
      arc.allowExtension &&
      currentChapter > arc.plannedChapterEnd + arc.maxExtensionChapters;

    if (isOverExtension) {
      return ArcCompletionResult.FAIL;
    }

    // All required milestones complete + in range: COMPLETE
    if (milestoneCompletionRate >= 1.0 && exitConditions.length > 0) {
      return ArcCompletionResult.COMPLETE;
    }

    // Milestone completion reasonable but chapter range not reached: EXTEND
    if (milestoneCompletionRate >= 0.7 && currentChapter <= arc.plannedChapterEnd) {
      return ArcCompletionResult.EXTEND;
    }

    // Major incompletion: REPLAN
    if (milestoneCompletionRate < 0.5) {
      return ArcCompletionResult.REPLAN;
    }

    return ArcCompletionResult.COMPLETE;
  }

  // ====================================================================
  // Private helpers
  // ====================================================================

  private computeCompletionScore(
    completed: number,
    missed: number,
    forbidden: number,
    total: number
  ): number {
    if (total === 0) return 1.0; // nothing was required
    const base = total > 0 ? completed / total : 1.0;
    const penalty = forbidden * 0.3;
    return Math.max(0, Math.min(1.0, Math.round((base - penalty) * 1000) / 1000));
  }

  private async updateMilestones(
    novelId: string,
    chapterNumber: number,
    actualEvents: string[],
    deviation: DeviationType
  ): Promise<{ triggered: string[]; invalidated: string[] }> {
    const triggered: string[] = [];
    const invalidated: string[] = [];

    const candidateMilestones = await db.narrativeMilestoneRecord.findMany({
      where: {
        novelId,
        status: { in: [MilestoneStatus.PLANNED, MilestoneStatus.AVAILABLE] },
        plannedChapterMin: { lte: chapterNumber + 5 },
      },
    });

    for (const ms of candidateMilestones) {
      const titleLower = ms.title.toLowerCase();
      const delivered = actualEvents.some(
        (e) => e.toLowerCase().includes(titleLower.split(' ')[0] ?? '')
      );

      if (delivered && ms.plannedChapterMin <= chapterNumber && ms.plannedChapterMax >= chapterNumber) {
        await db.narrativeMilestoneRecord.update({
          where: { id: ms.id },
          data: { status: MilestoneStatus.TRIGGERED, actualChapter: chapterNumber },
        }).catch(() => {});
        triggered.push(ms.id);
      }

      // Invalidate if forbidden events triggered matching milestone prerequisites
      if (deviation === DeviationType.MAJOR_DEVIATION && ms.plannedChapterMax < chapterNumber) {
        await db.narrativeMilestoneRecord.update({
          where: { id: ms.id },
          data: { status: MilestoneStatus.MISSED },
        }).catch(() => {});
        invalidated.push(ms.id);
      }
    }

    return { triggered, invalidated };
  }

  private async updateObligations(
    novelId: string,
    chapterNumber: number,
    actualEvents: string[]
  ): Promise<{ progressed: string[]; satisfied: string[] }> {
    const progressed: string[] = [];
    const satisfied: string[] = [];

    const openObligations = await db.narrativeObligationRecord.findMany({
      where: {
        novelId,
        status: { in: [ObligationStatus.OPEN, ObligationStatus.PROGRESSING] },
      },
      take: 20,
    });

    for (const ob of openObligations) {
      const descWords = ob.description.toLowerCase().split(' ').slice(0, 3).join(' ');
      const mentioned = actualEvents.some((e) => e.toLowerCase().includes(descWords));

      if (mentioned) {
        const isResolution =
          ob.targetResolutionChapter && ob.targetResolutionChapter <= chapterNumber + 2;

        if (isResolution) {
          await db.narrativeObligationRecord.update({
            where: { id: ob.id },
            data: { status: ObligationStatus.SATISFIED, latestResolutionChapter: chapterNumber },
          }).catch(() => {});
          satisfied.push(ob.id);
        } else {
          const notes = (ob.progressNotes as string[]) ?? [];
          notes.push(`Chapter ${chapterNumber}: progressed`);
          await db.narrativeObligationRecord.update({
            where: { id: ob.id },
            data: { status: ObligationStatus.PROGRESSING, progressNotes: notes },
          }).catch(() => {});
          progressed.push(ob.id);
        }
      }
    }

    return { progressed, satisfied };
  }

  private async detectForeshadowingSetups(
    novelId: string,
    chapterNumber: number,
    actualEvents: string[]
  ): Promise<string[]> {
    const plans = await db.foreshadowingPlanRecord.findMany({
      where: {
        novelId,
        status: 'PLANNED',
        revealWindowStart: { lte: chapterNumber },
        revealWindowEnd: { gte: chapterNumber },
      },
      take: 10,
    });

    const delivered: string[] = [];
    for (const fp of plans) {
      const descWords = fp.description.toLowerCase().split(' ').slice(0, 2).join(' ');
      if (actualEvents.some((e) => e.toLowerCase().includes(descWords))) {
        await this.foreshadowingManager.recordSetup(novelId, fp.id, chapterNumber);
        delivered.push(fp.id);
      }
    }
    return delivered;
  }

  private async detectForeshadowingPayoffs(
    novelId: string,
    chapterNumber: number,
    actualEvents: string[]
  ): Promise<string[]> {
    const plans = await db.foreshadowingPlanRecord.findMany({
      where: {
        novelId,
        status: 'ACTIVE',
        payoffWindowStart: { lte: chapterNumber },
        payoffWindowEnd: { gte: chapterNumber },
      },
      take: 10,
    });

    const paidOff: string[] = [];
    for (const fp of plans) {
      const descWords = fp.description.toLowerCase().split(' ').slice(0, 2).join(' ');
      if (actualEvents.some((e) => e.toLowerCase().includes(descWords))) {
        await this.foreshadowingManager.recordPayoff(novelId, fp.id, chapterNumber);
        paidOff.push(fp.id);
      }
    }
    return paidOff;
  }

  private async checkArcCompletion(
    novelId: string,
    chapterNumber: number,
    longHorizonPlanId: string
  ): Promise<void> {
    const activeArc = await db.storyArcPlan.findFirst({
      where: { novelId, longHorizonPlanId, status: ArcStatus.ACTIVE },
    });

    if (!activeArc) return;

    if (chapterNumber >= activeArc.plannedChapterEnd) {
      const result = await this.evaluateArcCompletion(novelId, activeArc.id, chapterNumber);

      if (result === ArcCompletionResult.COMPLETE) {
        // Complete arc, activate next
        await db.storyArcPlan.update({
          where: { id: activeArc.id },
          data: { status: ArcStatus.COMPLETED, actualChapterEnd: chapterNumber },
        }).catch(() => {});

        const nextArc = await db.storyArcPlan.findFirst({
          where: {
            longHorizonPlanId,
            status: ArcStatus.PLANNED,
            arcNumber: { gt: activeArc.arcNumber },
          },
          orderBy: { arcNumber: 'asc' },
        });

        if (nextArc) {
          await db.storyArcPlan.update({
            where: { id: nextArc.id },
            data: { status: ArcStatus.ACTIVE, actualChapterStart: chapterNumber + 1 },
          }).catch(() => {});

          await db.longHorizonPlan.update({
            where: { id: longHorizonPlanId },
            data: { activeArcId: nextArc.id },
          }).catch(() => {});

          obs.recordPhase9Event({
            type: 'STORY_STATE_PROMOTED',
            novelId,
            timestamp: new Date(),
            metadata: { event: 'arc.completed', completedArc: activeArc.title, nextArc: nextArc.title },
          });
        }
      } else if (result === ArcCompletionResult.EXTEND) {
        // Extend arc by default extension amount
        await db.storyArcPlan.update({
          where: { id: activeArc.id },
          data: { plannedChapterEnd: activeArc.plannedChapterEnd + 10 },
        }).catch(() => {});
      }
    }
  }

  private buildEmptyResult(
    novelId: string,
    chapterNumber: number,
    chapterObjectiveId: string,
    longHorizonPlanId: string
  ): PlanReconciliationResult {
    return {
      novelId,
      chapterNumber,
      chapterObjectiveId,
      deviationType: DeviationType.ON_PLAN,
      objectiveCompletionScore: 1.0,
      completedRequiredEvents: [],
      missedRequiredEvents: [],
      forbiddenEventsTriggered: [],
      milestonesTriggered: [],
      milestonesInvalidated: [],
      obligationsProgressed: [],
      obligationsSatisfied: [],
      foreshadowingDelivered: [],
      foreshadowingPaidOff: [],
      requiresReplanning: false,
      createdAt: new Date(),
    };
  }
}
