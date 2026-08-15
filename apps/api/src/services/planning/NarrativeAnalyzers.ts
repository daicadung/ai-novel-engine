import {
  NarrativeBalance,
  NarrativeImbalance,
  PlanningQualityScore,
  MilestoneStatus,
  ObligationStatus,
  ForeshadowingStatus,
} from '@ane/core';

/**
 * NarrativeBalanceAnalyzer
 *
 * Measures long-term narrative balance over rolling windows.
 * Pure computation — no DB, no LLM.
 * All inputs come from caller (PlanningOrchestrator).
 */
export class NarrativeBalanceAnalyzer {
  /**
   * Analyze narrative balance from rolling window of chapter memories.
   */
  static analyze(
    novelId: string,
    windowStart: number,
    windowEnd: number,
    memories: Array<{
      chapterNumber: number;
      summary: string;
      keyEvents: string[];
      stateDeltas: Array<{ entityType: string; entityId: string }>;
      resolvedThreads: string[];
      unresolvedThreads: string[];
    }>,
    activeThreadTitles: string[],
    characterIds: string[]
  ): NarrativeBalance {
    const imbalances: NarrativeImbalance[] = [];

    // ---- Main vs side plot ----
    const mainPlotKeywords = ['protagonist', 'hero', 'main', 'central', 'primary'];
    let mainChapters = 0;
    let sideChapters = 0;

    for (const mem of memories) {
      const isMain = mainPlotKeywords.some((kw) =>
        mem.summary.toLowerCase().includes(kw) || mem.keyEvents.some((e) => e.toLowerCase().includes(kw))
      );
      if (isMain) mainChapters++;
      else sideChapters++;
    }

    const total = Math.max(memories.length, 1);
    const mainPlotRatio = mainChapters / total;
    const sidePlotRatio = sideChapters / total;

    if (mainPlotRatio < 0.3) {
      imbalances.push({
        dimension: 'MAIN_PLOT',
        severity: 'HIGH',
        description: `Main plot receiving only ${Math.round(mainPlotRatio * 100)}% focus in window ${windowStart}–${windowEnd}`,
        suggestedCorrection: 'Increase chapters advancing main protagonist objective',
      });
    }

    if (sidePlotRatio > 0.7) {
      imbalances.push({
        dimension: 'SIDE_PLOT_OVERLOAD',
        severity: 'MEDIUM',
        description: `Side plots dominating ${Math.round(sidePlotRatio * 100)}% of chapters`,
        suggestedCorrection: 'Reduce side plot focus for next 5 chapters',
      });
    }

    // ---- Character focus distribution ----
    const characterFocusDistribution: Record<string, number> = {};
    for (const id of characterIds) {
      characterFocusDistribution[id] = 0;
    }

    for (const mem of memories) {
      for (const delta of mem.stateDeltas) {
        if (delta.entityType === 'CHARACTER' && characterIds.includes(delta.entityId)) {
          characterFocusDistribution[delta.entityId] =
            (characterFocusDistribution[delta.entityId] ?? 0) + 1;
        }
      }
    }

    // Characters with 0 progress
    for (const [charId, count] of Object.entries(characterFocusDistribution)) {
      if (count === 0 && memories.length >= 5) {
        imbalances.push({
          dimension: 'CHARACTER_NEGLECT',
          severity: 'LOW',
          description: `Character ${charId} has no story progress in window ${windowStart}–${windowEnd}`,
          suggestedCorrection: `Include character ${charId} in next chapter objective`,
        });
      }
    }

    // ---- Thread distribution ----
    const threadDistribution: Record<string, number> = {};
    for (const mem of memories) {
      for (const t of mem.unresolvedThreads) {
        threadDistribution[t] = (threadDistribution[t] ?? 0) + 1;
      }
    }

    const neglectedThreads = Object.entries(threadDistribution)
      .filter(([, count]) => count === 0)
      .map(([title]) => title);

    if (neglectedThreads.length > 2) {
      imbalances.push({
        dimension: 'THREAD_NEGLECT',
        severity: 'MEDIUM',
        description: `${neglectedThreads.length} threads not referenced in window: ${neglectedThreads.slice(0, 3).join(', ')}`,
        suggestedCorrection: 'Include neglected threads in next chapter objectives',
      });
    }

    // ---- Setup vs payoff ----
    const setups = memories.flatMap((m) => m.unresolvedThreads).length;
    const payoffs = memories.flatMap((m) => m.resolvedThreads).length;
    const setupPayoffRatio = payoffs > 0 ? setups / payoffs : setups > 0 ? Infinity : 1;

    if ((isFinite(setupPayoffRatio) && setupPayoffRatio > 5) || (setups > 5 && payoffs === 0)) {
      imbalances.push({
        dimension: 'SETUP_OVERLOAD',
        severity: 'HIGH',
        description: `${setups} setups vs ${payoffs} payoffs in window — ratio ${setupPayoffRatio.toFixed(1)}`,
        suggestedCorrection: 'Deliver payoffs for established setups before adding more',
      });
    }

    // ---- Action vs reflection ----
    const actionKeywords = ['fight', 'attack', 'battle', 'escape', 'chase', 'combat'];
    const reflectionKeywords = ['think', 'reflect', 'dream', 'memory', 'recall', 'consider'];

    let actionCount = 0;
    let reflectionCount = 0;

    for (const mem of memories) {
      const text = (mem.summary + ' ' + mem.keyEvents.join(' ')).toLowerCase();
      if (actionKeywords.some((kw) => text.includes(kw))) actionCount++;
      if (reflectionKeywords.some((kw) => text.includes(kw))) reflectionCount++;
    }

    const actionVsReflectionRatio =
      reflectionCount > 0 ? actionCount / reflectionCount : actionCount;

    if (isFinite(actionVsReflectionRatio) && actionVsReflectionRatio > 8) {
      imbalances.push({
        dimension: 'PACING_IMBALANCE',
        severity: 'LOW',
        description: 'Too much action, insufficient reflection for character development',
        suggestedCorrection: 'Add introspective scene to slow pacing',
      });
    }

    // ---- Overall balance score ----
    const severityScores = imbalances.map((i) =>
      i.severity === 'HIGH' ? 0.3 : i.severity === 'MEDIUM' ? 0.15 : 0.05
    );
    const penalty = severityScores.reduce((a, b) => a + b, 0);
    const overallBalance = Math.max(0, Math.min(1, 1.0 - penalty));

    return {
      novelId,
      windowStart,
      windowEnd,
      mainPlotRatio: Math.round(mainPlotRatio * 1000) / 1000,
      sidePlotRatio: Math.round(sidePlotRatio * 1000) / 1000,
      characterFocusDistribution,
      threadDistribution,
      setupPayoffRatio: isFinite(setupPayoffRatio)
        ? Math.round(setupPayoffRatio * 100) / 100
        : setups,
      actionVsReflectionRatio: isFinite(actionVsReflectionRatio)
        ? Math.round(actionVsReflectionRatio * 100) / 100
        : actionCount,
      imbalances,
      overallBalance: Math.round(overallBalance * 1000) / 1000,
      computedAt: new Date(),
    };
  }
}

// ====================================================================
// PlanningQualityScorer
// ====================================================================

/**
 * PlanningQualityScorer
 *
 * Computes planning quality independent from prose quality (Phase 10).
 * Pure computation — no DB, no LLM.
 */
export class PlanningQualityScorer {
  /**
   * Compute PlanningQualityScore from planning state.
   * All inputs provided by caller.
   */
  static compute(
    novelId: string,
    chapterNumber: number,
    opts: {
      arcPlan?: {
        objective: string;
        exitConditions: string[];
        status: string;
      };
      milestones: Array<{ status: string; isOptional: boolean }>;
      obligations: Array<{ status: string; priority: number }>;
      foreshadowingPlans: Array<{ status: string; actualSetupCount: number; minimumOccurrences: number }>;
      recentObjectiveCompletionScores: number[];
      deviationHistory: string[];
      characterArcProgress: number[];
    }
  ): PlanningQualityScore {
    // 1. Objective clarity (arc has clear objective + exit conditions)
    const objectiveClarity = opts.arcPlan
      ? opts.arcPlan.objective.length > 20 && opts.arcPlan.exitConditions.length > 0
        ? 0.9
        : 0.5
      : 0.3;

    // 2. Milestone progression
    const ms = opts.milestones;
    const completedRequired = ms.filter(
      (m) => !m.isOptional && (m.status === MilestoneStatus.COMPLETED || m.status === MilestoneStatus.TRIGGERED)
    ).length;
    const totalRequired = ms.filter((m) => !m.isOptional).length;
    const milestoneProgression = totalRequired > 0 ? completedRequired / totalRequired : 1.0;

    // 3. Obligation health
    const ob = opts.obligations;
    const openHigh = ob.filter(
      (o) => o.status === ObligationStatus.OPEN && o.priority >= 8
    ).length;
    const obligationHealth = Math.max(0, 1.0 - openHigh * 0.15);

    // 4. Foreshadowing health
    const fp = opts.foreshadowingPlans;
    const problemFp = fp.filter(
      (f) =>
        f.status === ForeshadowingStatus.FORGOTTEN ||
        (f.status === ForeshadowingStatus.PLANNED && f.actualSetupCount === 0)
    ).length;
    const foreshadowingHealth = fp.length > 0 ? Math.max(0, 1.0 - problemFp / fp.length) : 1.0;

    // 5. Character arc progression
    const charProgress = opts.characterArcProgress;
    const characterArcProgression =
      charProgress.length > 0
        ? charProgress.reduce((a, b) => a + b, 0) / charProgress.length
        : 1.0;

    // 6. Plot progression (from recent objective completion scores)
    const plotProgression =
      opts.recentObjectiveCompletionScores.length > 0
        ? opts.recentObjectiveCompletionScores.reduce((a, b) => a + b, 0) /
          opts.recentObjectiveCompletionScores.length
        : 1.0;

    // 7. Plan adherence (from deviation history)
    const majorDeviations = opts.deviationHistory.filter(
      (d) => d === 'MAJOR_DEVIATION' || d === 'PLAN_INVALID'
    ).length;
    const totalChapters = Math.max(opts.deviationHistory.length, 1);
    const planAdherence = Math.max(0, 1.0 - majorDeviations / totalChapters);

    // 8. Adaptability: how often minor deviations were handled
    const minorDeviations = opts.deviationHistory.filter(
      (d) => d === 'MINOR_DEVIATION' || d === 'ADAPTABLE_DEVIATION'
    ).length;
    const adaptability =
      totalChapters > 5
        ? Math.min(1.0, 0.5 + (minorDeviations / totalChapters) * 0.5)
        : 0.7;

    // Overall — weighted average
    const overall =
      objectiveClarity * 0.1 +
      milestoneProgression * 0.2 +
      obligationHealth * 0.1 +
      foreshadowingHealth * 0.1 +
      characterArcProgression * 0.2 +
      plotProgression * 0.15 +
      planAdherence * 0.1 +
      adaptability * 0.05;

    const round = (n: number) => Math.round(n * 1000) / 1000;

    return {
      novelId,
      chapterNumber,
      objectiveClarity: round(objectiveClarity),
      milestoneProgression: round(milestoneProgression),
      obligationHealth: round(obligationHealth),
      foreshadowingHealth: round(foreshadowingHealth),
      characterArcProgression: round(characterArcProgression),
      plotProgression: round(plotProgression),
      planAdherence: round(planAdherence),
      adaptability: round(adaptability),
      overall: round(overall),
      computedAt: new Date(),
    };
  }
}
