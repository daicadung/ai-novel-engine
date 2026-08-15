import { db } from '@ane/database';
import {
  PlanningWindowContext,
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

const WINDOW_CHAPTERS = parseInt(process.env.PLANNING_WINDOW_CHAPTERS ?? '20', 10);
const MAX_MILESTONES_IN_WINDOW = parseInt(process.env.PLANNING_MAX_MILESTONES ?? '10', 10);
const MAX_OBLIGATIONS_IN_WINDOW = parseInt(process.env.PLANNING_MAX_OBLIGATIONS ?? '10', 10);
const MAX_FORESHADOWING_IN_WINDOW = parseInt(process.env.PLANNING_MAX_FORESHADOWING ?? '10', 10);

/**
 * PlanningWindowBuilder
 *
 * Constructs bounded planning context for chapter generation.
 * NEVER loads full novel — always uses bounded queries.
 * Pure DB read, no mutations.
 */
export class PlanningWindowBuilder {
  async build(
    novelId: string,
    currentChapter: number,
    longHorizonPlanId: string
  ): Promise<PlanningWindowContext> {
    const windowChapters = WINDOW_CHAPTERS;
    const lookAheadEnd = currentChapter + windowChapters;

    // ---- 1. Active arc plan ----
    const activeArcRecord = await db.storyArcPlan.findFirst({
      where: {
        novelId,
        longHorizonPlanId,
        status: ArcStatus.ACTIVE,
      },
    });

    const activeArcPlan: StoryArcPlan | undefined = activeArcRecord
      ? this.mapArcPlan(activeArcRecord)
      : undefined;

    // If no active arc, find next planned arc
    const nextArcRecord = !activeArcRecord
      ? await db.storyArcPlan.findFirst({
          where: {
            novelId,
            longHorizonPlanId,
            status: ArcStatus.PLANNED,
            plannedChapterStart: { lte: currentChapter + 5 },
          },
          orderBy: { arcNumber: 'asc' },
        })
      : null;

    const effectiveArcPlan = activeArcPlan ?? (nextArcRecord ? this.mapArcPlan(nextArcRecord) : undefined);

    // ---- 2. Upcoming milestones (bounded look-ahead) ----
    const milestoneRecords = await db.narrativeMilestoneRecord.findMany({
      where: {
        novelId,
        status: { in: [MilestoneStatus.PLANNED, MilestoneStatus.AVAILABLE] },
        plannedChapterMin: { lte: lookAheadEnd },
      },
      orderBy: [{ priority: 'desc' }, { plannedChapterMin: 'asc' }],
      take: MAX_MILESTONES_IN_WINDOW,
    });

    const upcomingMilestones: NarrativeMilestone[] = milestoneRecords.map(this.mapMilestone);

    // ---- 3. Recent chapter summaries (bounded) ----
    const recentMemories = await db.chapterMemoryRecord.findMany({
      where: {
        novelId,
        chapterNumber: {
          gte: Math.max(1, currentChapter - windowChapters),
          lt: currentChapter,
        },
      },
      orderBy: { chapterNumber: 'desc' },
      take: windowChapters,
      select: { chapterNumber: true, summary: true },
    });

    const recentChapterSummaries = recentMemories
      .reverse()
      .map((m) => `Chapter ${m.chapterNumber}: ${m.summary}`);

    // ---- 4. Open obligations ----
    const obligationRecords = await db.narrativeObligationRecord.findMany({
      where: {
        novelId,
        status: { in: [ObligationStatus.OPEN, ObligationStatus.PROGRESSING] },
      },
      orderBy: [{ priority: 'desc' }, { establishedChapter: 'asc' }],
      take: MAX_OBLIGATIONS_IN_WINDOW,
    });

    const openObligations: NarrativeObligation[] = obligationRecords.map(this.mapObligation);

    // ---- 5. Pending foreshadowing ----
    const foreshadowingRecords = await db.foreshadowingPlanRecord.findMany({
      where: {
        novelId,
        status: {
          in: [ForeshadowingStatus.PLANNED, ForeshadowingStatus.ACTIVE],
        },
        payoffWindowStart: { lte: lookAheadEnd },
      },
      orderBy: { payoffWindowStart: 'asc' },
      take: MAX_FORESHADOWING_IN_WINDOW,
    });

    const pendingForeshadowing: ForeshadowingPlanRecord[] = foreshadowingRecords.map(
      this.mapForeshadowing
    );

    // ---- 6. Active character arcs ----
    const charArcRecords = await db.phase11CharacterArcPlan.findMany({
      where: {
        novelId,
        status: 'ACTIVE',
        ...(effectiveArcPlan ? { arcPlanId: effectiveArcPlan.id } : {}),
      },
      take: 8,
    });

    const activeCharacterArcs: CharacterArcPlanDetail[] = charArcRecords.map(
      this.mapCharacterArcPlan
    );

    // ---- 7. Active thread titles ----
    const activeThreads = await db.plotThread.findMany({
      where: { novelId, status: 'ACTIVE' },
      select: { title: true },
      take: 15,
    });
    const activeThreadTitles = activeThreads.map((t) => t.title);

    // ---- 8. Latest quality trend ----
    const latestTrend = await db.qualityTrendRecord.findFirst({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      select: { healthStatus: true },
    });
    const qualityTrend = latestTrend?.healthStatus ?? 'HEALTHY';

    return {
      novelId,
      currentChapter,
      activeArcPlan: effectiveArcPlan,
      upcomingMilestones,
      recentChapterSummaries,
      openObligations,
      pendingForeshadowing,
      activeCharacterArcs,
      activeThreadTitles,
      qualityTrend,
      windowChapters,
      computedAt: new Date(),
    };
  }

  // ====================================================================
  // Mappers (raw DB → domain types)
  // ====================================================================

  private mapArcPlan(r: any): StoryArcPlan {
    return {
      id: r.id,
      longHorizonPlanId: r.longHorizonPlanId,
      novelId: r.novelId,
      arcNumber: r.arcNumber,
      title: r.title,
      purpose: r.purpose,
      objective: r.objective,
      conflict: r.conflict,
      stakes: r.stakes,
      entryConditions: r.entryConditions ?? [],
      exitConditions: r.exitConditions ?? [],
      plannedChapterStart: r.plannedChapterStart,
      plannedChapterEnd: r.plannedChapterEnd,
      actualChapterStart: r.actualChapterStart ?? undefined,
      actualChapterEnd: r.actualChapterEnd ?? undefined,
      status: r.status as ArcStatus,
      priority: r.priority,
      allowExtension: r.allowExtension,
      maxExtensionChapters: r.maxExtensionChapters,
      characterFocusIds: r.characterFocusIds ?? [],
      threadFocusIds: r.threadFocusIds ?? [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapMilestone(r: any): NarrativeMilestone {
    return {
      id: r.id,
      novelId: r.novelId,
      arcPlanId: r.arcPlanId ?? undefined,
      milestoneType: r.milestoneType as any,
      title: r.title,
      description: r.description,
      plannedChapterMin: r.plannedChapterMin,
      plannedChapterMax: r.plannedChapterMax,
      actualChapter: r.actualChapter ?? undefined,
      status: r.status as MilestoneStatus,
      prerequisites: r.prerequisites ?? [],
      consequences: r.consequences ?? [],
      involvedEntityIds: r.involvedEntityIds ?? [],
      priority: r.priority,
      isOptional: r.isOptional,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapObligation(r: any): NarrativeObligation {
    return {
      id: r.id,
      novelId: r.novelId,
      obligationType: r.obligationType as any,
      description: r.description,
      establishedChapter: r.establishedChapter,
      establishedBy: r.establishedBy,
      targetResolutionChapter: r.targetResolutionChapter ?? undefined,
      latestResolutionChapter: r.latestResolutionChapter ?? undefined,
      status: r.status as ObligationStatus,
      progressNotes: r.progressNotes ?? [],
      involvedEntityIds: r.involvedEntityIds ?? [],
      dependentObligationIds: r.dependentObligationIds ?? [],
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapForeshadowing(r: any): ForeshadowingPlanRecord {
    return {
      id: r.id,
      novelId: r.novelId,
      targetMilestoneId: r.targetMilestoneId ?? undefined,
      targetObligationId: r.targetObligationId ?? undefined,
      setupType: r.setupType,
      plannedSetupChapters: r.plannedSetupChapters ?? [],
      minimumOccurrences: r.minimumOccurrences,
      actualSetupCount: r.actualSetupCount,
      revealWindowStart: r.revealWindowStart,
      revealWindowEnd: r.revealWindowEnd,
      payoffWindowStart: r.payoffWindowStart,
      payoffWindowEnd: r.payoffWindowEnd,
      strength: r.strength as any,
      status: r.status as ForeshadowingStatus,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private mapCharacterArcPlan(r: any): CharacterArcPlanDetail {
    return {
      id: r.id,
      novelId: r.novelId,
      characterId: r.characterId,
      storyArcPlanId: r.arcPlanId ?? undefined,
      startingState: r.startingState,
      currentState: r.currentState,
      targetState: r.targetState,
      milestones: r.milestones ?? [],
      internalConflict: r.internalConflict,
      externalConflict: r.externalConflict,
      relationshipMilestones: r.relationshipMilestones ?? [],
      turningPoints: r.turningPoints ?? [],
      resolutionCriteria: r.resolutionCriteria,
      status: r.status as any,
      progressScore: r.progressScore,
      updatedAt: r.updatedAt,
    };
  }
}
