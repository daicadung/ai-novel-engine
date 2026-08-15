import { db } from '@ane/database';
import {
  ChapterObjective,
  StoryArcPlan,
  NarrativeMilestone,
  NarrativeObligation,
  ForeshadowingPlanRecord,
  CharacterArcPlanDetail,
  ArcStatus,
  MilestoneStatus,
  ObligationStatus,
  ForeshadowingStatus,
} from '@ane/core';
import { randomUUID } from 'node:crypto';

/**
 * ChapterObjectivePlanner
 *
 * Deterministic planner — generates ChapterObjective from planning context.
 * Pure computation, no LLM.
 * LLM-assisted planning is handled by LongHorizonPlanner.
 */
export class ChapterObjectivePlanner {
  /**
   * Generate a ChapterObjective for the given chapter.
   * Returns null if no long-horizon plan exists.
   */
  async planObjective(
    novelId: string,
    chapterNumber: number,
    opts?: {
      longHorizonPlanId?: string;
      arcPlan?: StoryArcPlan;
      upcomingMilestones?: NarrativeMilestone[];
      openObligations?: NarrativeObligation[];
      pendingForeshadowing?: ForeshadowingPlanRecord[];
      characterArcs?: CharacterArcPlanDetail[];
      activeThreadTitles?: string[];
      qualityTrend?: string;
    }
  ): Promise<ChapterObjective | null> {
    // Find active plan if not provided
    const planId = opts?.longHorizonPlanId ?? await this.findActivePlanId(novelId);
    if (!planId) return null;

    // Find active arc
    const arcPlan = opts?.arcPlan ?? await this.findActiveArcPlan(novelId, planId);

    // Check for existing draft objective (idempotent)
    const existing = await db.chapterObjectiveRecord.findFirst({
      where: { novelId, chapterNumber, longHorizonPlanId: planId, status: 'DRAFT' },
    });
    if (existing) {
      return this.mapObjective(existing);
    }

    // Build objective from planning context
    const milestones = opts?.upcomingMilestones ?? [];
    const obligations = opts?.openObligations ?? [];
    const foreshadowing = opts?.pendingForeshadowing ?? [];
    const characterArcs = opts?.characterArcs ?? [];
    const activeThreadTitles = opts?.activeThreadTitles ?? [];

    // Determine what must happen in this chapter
    const requiredEvents = this.deriveRequiredEvents(
      chapterNumber, arcPlan, milestones, obligations
    );

    // Determine what must NOT happen
    const forbiddenEvents = this.deriveForbiddenEvents(arcPlan, milestones);

    // Character goals from arcs
    const characterGoals = characterArcs
      .filter((ca) => ca.status === 'ACTIVE')
      .slice(0, 5)
      .map((ca) => ({
        characterId: ca.characterId,
        goal: this.selectNextMilestoneGoal(ca, chapterNumber),
      }))
      .filter((cg) => cg.goal.length > 0);

    // Plot thread goals
    const plotThreadGoals = activeThreadTitles.slice(0, 5).map((title) => ({
      threadId: title,
      advancement: `Advance thread: ${title}`,
    }));

    // Setup actions (foreshadowing to plant this chapter)
    const setupActions = foreshadowing
      .filter(
        (fp) =>
          fp.status === ForeshadowingStatus.PLANNED &&
          fp.revealWindowStart <= chapterNumber &&
          fp.revealWindowEnd >= chapterNumber &&
          fp.actualSetupCount < fp.minimumOccurrences
      )
      .slice(0, 3)
      .map((fp) => `Plant setup: ${fp.description}`);

    // Payoff actions (foreshadowing to pay off this chapter)
    const payoffActions = foreshadowing
      .filter(
        (fp) =>
          fp.status === ForeshadowingStatus.ACTIVE &&
          fp.payoffWindowStart <= chapterNumber &&
          fp.payoffWindowEnd >= chapterNumber
      )
      .slice(0, 2)
      .map((fp) => `Deliver payoff: ${fp.description}`);

    // Tension target — escalate toward arc end
    const tensionTarget = this.computeTensionTarget(chapterNumber, arcPlan, opts?.qualityTrend);

    // Ending target
    const endingTarget = this.deriveEndingTarget(chapterNumber, arcPlan, milestones);

    // Primary objective
    const primaryObjective = arcPlan
      ? `In service of "${arcPlan.title}": advance the story toward: ${arcPlan.objective}`
      : `Generate chapter ${chapterNumber} aligned with the novel's global objectives`;

    // Secondary objectives
    const secondaryObjectives: string[] = [];
    if (obligations.length > 0) {
      const topObligation = obligations.sort((a, b) => b.priority - a.priority)[0];
      secondaryObjectives.push(`Progress obligation: ${topObligation.description}`);
    }
    if (setupActions.length > 0) secondaryObjectives.push(...setupActions.slice(0, 2));

    const id = this.buildObjectiveId(novelId, chapterNumber, planId);

    // Persist (idempotent upsert via unique id)
    await db.chapterObjectiveRecord.upsert({
      where: { id },
      create: {
        id,
        novelId,
        chapterNumber,
        longHorizonPlanId: planId,
        arcPlanId: arcPlan?.id ?? null,
        primaryObjective,
        secondaryObjectives,
        requiredEvents,
        forbiddenEvents,
        characterGoals,
        plotThreadGoals,
        requiredStateChanges: [],
        setupActions,
        payoffActions,
        tensionTarget,
        endingTarget,
        dependencies: [],
        status: 'DRAFT',
      },
      update: {},
    });

    return {
      id,
      novelId,
      chapterNumber,
      arcPlanId: arcPlan?.id ?? '',
      primaryObjective,
      secondaryObjectives,
      requiredEvents,
      forbiddenEvents,
      characterGoals,
      plotThreadGoals,
      requiredStateChanges: [],
      setupActions,
      payoffActions,
      tensionTarget,
      endingTarget,
      dependencies: [],
      status: 'DRAFT',
      createdAt: new Date(),
    };
  }

  // ====================================================================
  // Helpers
  // ====================================================================

  private async findActivePlanId(novelId: string): Promise<string | null> {
    const plan = await db.longHorizonPlan.findFirst({
      where: { novelId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    return plan?.id ?? null;
  }

  private async findActiveArcPlan(
    novelId: string,
    planId: string
  ): Promise<StoryArcPlan | null> {
    const arc = await db.storyArcPlan.findFirst({
      where: { novelId, longHorizonPlanId: planId, status: ArcStatus.ACTIVE },
    });
    if (!arc) return null;
    return {
      id: arc.id,
      longHorizonPlanId: arc.longHorizonPlanId,
      novelId: arc.novelId,
      arcNumber: arc.arcNumber,
      title: arc.title,
      purpose: arc.purpose,
      objective: arc.objective,
      conflict: arc.conflict,
      stakes: arc.stakes,
      entryConditions: arc.entryConditions as string[],
      exitConditions: arc.exitConditions as string[],
      plannedChapterStart: arc.plannedChapterStart,
      plannedChapterEnd: arc.plannedChapterEnd,
      actualChapterStart: arc.actualChapterStart ?? undefined,
      actualChapterEnd: arc.actualChapterEnd ?? undefined,
      status: arc.status as ArcStatus,
      priority: arc.priority,
      allowExtension: arc.allowExtension,
      maxExtensionChapters: arc.maxExtensionChapters,
      characterFocusIds: arc.characterFocusIds as string[],
      threadFocusIds: arc.threadFocusIds as string[],
      createdAt: arc.createdAt,
      updatedAt: arc.updatedAt,
    };
  }

  private deriveRequiredEvents(
    chapterNumber: number,
    arc: StoryArcPlan | null | undefined,
    milestones: NarrativeMilestone[],
    obligations: NarrativeObligation[]
  ): string[] {
    const events: string[] = [];

    // Milestones whose window includes this chapter
    for (const ms of milestones) {
      if (
        ms.plannedChapterMin <= chapterNumber &&
        ms.plannedChapterMax >= chapterNumber &&
        ms.status === MilestoneStatus.AVAILABLE &&
        !ms.isOptional
      ) {
        events.push(`Trigger milestone: ${ms.title} — ${ms.description}`);
      }
    }

    // Overdue obligations
    for (const ob of obligations) {
      if (
        ob.targetResolutionChapter &&
        ob.targetResolutionChapter <= chapterNumber + 3 &&
        ob.status === ObligationStatus.OPEN
      ) {
        events.push(`Progress obligation: ${ob.description}`);
      }
    }

    return events.slice(0, 5);
  }

  private deriveForbiddenEvents(
    arc: StoryArcPlan | null | undefined,
    milestones: NarrativeMilestone[]
  ): string[] {
    const events: string[] = [];
    // Milestones that are PLANNED but not yet AVAILABLE must not trigger
    for (const ms of milestones) {
      if (ms.status === MilestoneStatus.PLANNED && !ms.isOptional) {
        if (ms.prerequisites.length > 0) {
          events.push(`Prematurely trigger: ${ms.title} — prerequisites unmet`);
        }
      }
    }
    return events.slice(0, 3);
  }

  private selectNextMilestoneGoal(
    ca: CharacterArcPlanDetail,
    chapterNumber: number
  ): string {
    const nextMilestone = ca.milestones.find((m) => !m.achieved);
    if (nextMilestone) return `Work toward: ${nextMilestone.description}`;
    const nextTurning = ca.turningPoints.find((t) => !t.triggered);
    if (nextTurning) return `Approach turning point: ${nextTurning.description}`;
    return '';
  }

  private computeTensionTarget(
    chapterNumber: number,
    arc: StoryArcPlan | null | undefined,
    qualityTrend?: string
  ): ChapterObjective['tensionTarget'] {
    if (!arc) return 'MEDIUM';
    const arcLength = arc.plannedChapterEnd - arc.plannedChapterStart;
    const progress = (chapterNumber - arc.plannedChapterStart) / Math.max(arcLength, 1);

    // Low quality/energy → push for higher tension
    if (qualityTrend === 'CRITICAL' || qualityTrend === 'DEGRADING') {
      return progress > 0.5 ? 'CRITICAL' : 'HIGH';
    }

    if (progress < 0.2) return 'LOW';
    if (progress < 0.5) return 'MEDIUM';
    if (progress < 0.8) return 'HIGH';
    return 'CRITICAL';
  }

  private deriveEndingTarget(
    chapterNumber: number,
    arc: StoryArcPlan | null | undefined,
    milestones: NarrativeMilestone[]
  ): string {
    // Check if a milestone is due soon
    const imminent = milestones.find(
      (ms) =>
        ms.plannedChapterMax <= chapterNumber + 2 &&
        ms.status === MilestoneStatus.AVAILABLE
    );
    if (imminent) {
      return `End with the beginning of: ${imminent.title}`;
    }
    if (arc) {
      return `End advancing the arc conflict: ${arc.conflict}`;
    }
    return 'End with a scene that propels the reader forward';
  }

  buildObjectiveId(novelId: string, chapterNumber: number, planId: string): string {
    // Deterministic: same inputs → same ID
    const base = `obj:${novelId}:${chapterNumber}:${planId}`;
    // Use stable hash approach
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return `obj-${Math.abs(hash).toString(36)}-ch${chapterNumber}`;
  }

  private mapObjective(r: any): ChapterObjective {
    return {
      id: r.id,
      novelId: r.novelId,
      chapterNumber: r.chapterNumber,
      arcPlanId: r.arcPlanId ?? '',
      primaryObjective: r.primaryObjective,
      secondaryObjectives: r.secondaryObjectives ?? [],
      requiredEvents: r.requiredEvents ?? [],
      forbiddenEvents: r.forbiddenEvents ?? [],
      characterGoals: r.characterGoals ?? [],
      plotThreadGoals: r.plotThreadGoals ?? [],
      requiredStateChanges: r.requiredStateChanges ?? [],
      setupActions: r.setupActions ?? [],
      payoffActions: r.payoffActions ?? [],
      tensionTarget: r.tensionTarget as any,
      endingTarget: r.endingTarget,
      dependencies: r.dependencies ?? [],
      status: r.status as any,
      completionScore: r.completionScore ?? undefined,
      createdAt: r.createdAt,
    };
  }
}
