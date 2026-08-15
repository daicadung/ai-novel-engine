import {
  QualityScore,
  QualityDimension,
  QualityIssue,
  QualityIssueType,
  QualityIssueSeverity,
  QualityTrend,
  QualitySnapshot,
  QualityHealthStatus,
  ChapterMemory,
  StoryState,
  PlotThreadState,
} from '@ane/core';
import { createHash } from 'node:crypto';

// Default dimension weights
const DEFAULT_WEIGHTS: Record<string, number> = {
  continuity: 0.20,
  pacing: 0.15,
  characterProgression: 0.15,
  plotProgression: 0.15,
  tension: 0.10,
  novelty: 0.10,
  scenePurpose: 0.05,
  threadProgression: 0.05,
  setupPayoffHealth: 0.05,
};

// Configurable thresholds via environment variables
const PACING_MIN_EVENTS_PER_CHAPTER = parseFloat(process.env.QUALITY_MIN_EVENTS_PER_CHAPTER ?? '2');
const PACING_MAX_EVENTS_PER_CHAPTER = parseFloat(process.env.QUALITY_MAX_EVENTS_PER_CHAPTER ?? '15');
const THREAD_NEGLECT_CHAPTERS = parseInt(process.env.QUALITY_THREAD_NEGLECT_CHAPTERS ?? '20', 10);
const THREAD_OVERLOAD_COUNT = parseInt(process.env.QUALITY_THREAD_OVERLOAD_COUNT ?? '8', 10);
const DEGRADATION_WINDOW = parseInt(process.env.QUALITY_DEGRADATION_WINDOW ?? '5', 10);
const CONSECUTIVE_DROP_THRESHOLD = parseInt(process.env.QUALITY_CONSECUTIVE_DROP_THRESHOLD ?? '3', 10);
const LOW_SCORE_THRESHOLD = parseFloat(process.env.QUALITY_LOW_SCORE_THRESHOLD ?? '0.45');
const MIN_IMPROVEMENT_DELTA = parseFloat(process.env.QUALITY_MIN_IMPROVEMENT_DELTA ?? '0.05');

/**
 * QualityScoringEngine
 *
 * Deterministic, pure quality scoring.
 * NEVER modifies canonical state.
 * NEVER calls LLMs.
 * All scores are 0.0–1.0. All computations are reproducible.
 */
export class QualityScoringEngine {
  // ====================================================================
  // Compute quality score for a chapter
  // ====================================================================
  static computeScore(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      issues?: QualityIssue[];
      memory?: ChapterMemory;
      previousMemories?: ChapterMemory[];
      storyState?: StoryState;
      activeThreads?: PlotThreadState[];
      proseWordCount?: number;
      sceneCount?: number;
      continuityConflictCount?: number;
    } = {}
  ): QualityScore {
    const {
      issues = [],
      memory,
      previousMemories = [],
      storyState,
      activeThreads = [],
      proseWordCount = 0,
      sceneCount = 1,
      continuityConflictCount = 0,
    } = options;

    const now = new Date();

    // ---- Continuity Score ----
    const continuityScore = this.scoreContinuity(continuityConflictCount, issues);

    // ---- Pacing Score ----
    const pacingScore = this.scorePacing(memory, proseWordCount, sceneCount, issues);

    // ---- Character Progression Score ----
    const characterScore = this.scoreCharacterProgression(
      memory,
      previousMemories,
      storyState,
      issues
    );

    // ---- Plot Progression Score ----
    const plotScore = this.scorePlotProgression(memory, previousMemories, activeThreads, issues);

    // ---- Tension Score ----
    const tensionScore = this.scoreTension(memory, activeThreads, issues);

    // ---- Novelty Score ----
    const noveltyScore = this.scoreNovelty(memory, previousMemories, issues);

    // ---- Scene Purpose Score ----
    const scenePurposeScore = this.scoreScenePurpose(sceneCount, issues);

    // ---- Thread Progression Score ----
    const threadScore = this.scoreThreadProgression(activeThreads, memory, issues);

    // ---- Setup/Payoff Health Score ----
    const setupPayoffScore = this.scoreSetupPayoff(memory, previousMemories, issues);

    // ---- Overall weighted score ----
    const dimensionScores: Record<string, number> = {
      continuity: continuityScore.score,
      pacing: pacingScore.score,
      characterProgression: characterScore.score,
      plotProgression: plotScore.score,
      tension: tensionScore.score,
      novelty: noveltyScore.score,
      scenePurpose: scenePurposeScore.score,
      threadProgression: threadScore.score,
      setupPayoffHealth: setupPayoffScore.score,
    };

    const overall = Object.entries(DEFAULT_WEIGHTS).reduce((acc, [dim, w]) => {
      return acc + (dimensionScores[dim] ?? 0.5) * w;
    }, 0);

    return {
      overall: Math.round(overall * 1000) / 1000,
      continuity: continuityScore,
      pacing: pacingScore,
      characterProgression: characterScore,
      plotProgression: plotScore,
      tension: tensionScore,
      novelty: noveltyScore,
      scenePurpose: scenePurposeScore,
      threadProgression: threadScore,
      setupPayoffHealth: setupPayoffScore,
      computedAt: now,
      chapterId,
      chapterNumber,
      novelId,
    };
  }

  // ====================================================================
  // Trend analysis over a window of scores
  // ====================================================================
  static computeTrend(
    novelId: string,
    scoreHistory: Array<{ chapterNumber: number; overall: number }>,
    windowSize = DEGRADATION_WINDOW
  ): QualityTrend {
    if (scoreHistory.length === 0) {
      return this.emptyTrend(novelId);
    }

    const window = scoreHistory.slice(-windowSize);
    const sorted = [...window].sort((a, b) => a.chapterNumber - b.chapterNumber);

    const scores = sorted.map((s) => s.overall);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Direction: compare first half vs second half of window
    const mid = Math.floor(sorted.length / 2);
    const firstHalfAvg = scores.slice(0, mid || 1).reduce((a, b) => a + b, 0) / (mid || 1);
    const secondHalfAvg = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid || 1);
    const delta = secondHalfAvg - firstHalfAvg;

    const direction: QualityTrend['direction'] =
      delta > 0.03 ? 'IMPROVING' : delta < -0.03 ? 'DEGRADING' : 'STABLE';

    // Consecutive drops
    let consecutiveDrops = 0;
    for (let i = sorted.length - 1; i > 0; i--) {
      if (sorted[i].overall < sorted[i - 1].overall) {
        consecutiveDrops++;
      } else {
        break;
      }
    }

    // Consecutive low scores
    let consecutiveLow = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].overall < LOW_SCORE_THRESHOLD) {
        consecutiveLow++;
      } else {
        break;
      }
    }

    // Recovery detection
    const recoveryDetected =
      consecutiveDrops === 0 &&
      direction === 'IMPROVING' &&
      scoreHistory.length > windowSize &&
      secondHalfAvg > firstHalfAvg + 0.05;

    // Health status
    let healthStatus: QualityHealthStatus;
    if (consecutiveDrops >= CONSECUTIVE_DROP_THRESHOLD && avg < LOW_SCORE_THRESHOLD) {
      healthStatus = QualityHealthStatus.CRITICAL;
    } else if (consecutiveDrops >= CONSECUTIVE_DROP_THRESHOLD) {
      healthStatus = QualityHealthStatus.DEGRADING;
    } else if (consecutiveLow >= CONSECUTIVE_DROP_THRESHOLD) {
      healthStatus = QualityHealthStatus.STAGNANT;
    } else if (recoveryDetected) {
      healthStatus = QualityHealthStatus.RECOVERING;
    } else {
      healthStatus = QualityHealthStatus.HEALTHY;
    }

    return {
      novelId,
      windowStart: sorted[0]?.chapterNumber ?? 0,
      windowEnd: sorted[sorted.length - 1]?.chapterNumber ?? 0,
      scores: sorted,
      direction,
      consecutiveDrops,
      consecutiveLowScores: consecutiveLow,
      healthStatus,
      recoveryDetected,
      averageScore: Math.round(avg * 1000) / 1000,
      minScore: Math.round(min * 1000) / 1000,
      maxScore: Math.round(max * 1000) / 1000,
      computedAt: new Date(),
    };
  }

  // ====================================================================
  // Build QualitySnapshot
  // ====================================================================
  static buildSnapshot(
    novelId: string,
    chapterId: string | undefined,
    chapterNumber: number | undefined,
    score: QualityScore,
    issues: QualityIssue[],
    trend?: QualityTrend
  ): QualitySnapshot {
    const healthStatus = this.deriveHealthStatus(score, trend);
    const correlationId = this.buildCorrelationId(novelId, chapterNumber, score.computedAt);

    return {
      id: correlationId,
      novelId,
      chapterId,
      chapterNumber,
      score,
      issues,
      trend,
      healthStatus,
      createdAt: score.computedAt,
      correlationId,
    };
  }

  // ====================================================================
  // Dimension scorers (all pure, deterministic)
  // ====================================================================

  private static scoreContinuity(
    conflictCount: number,
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter((i) => i.issueType === QualityIssueType.CONTINUITY_CONFLICT)
      .map((i) => i.id);

    const score = conflictCount === 0
      ? 1.0
      : Math.max(0, 1.0 - conflictCount * 0.2);

    return {
      score: Math.round(score * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.continuity,
      issues: issueIds,
      trend: 'STABLE',
    };
  }

  private static scorePacing(
    memory: ChapterMemory | undefined,
    wordCount: number,
    sceneCount: number,
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.PACING_TOO_FAST ||
          i.issueType === QualityIssueType.PACING_TOO_SLOW
      )
      .map((i) => i.id);

    const eventCount = memory?.keyEvents?.length ?? 0;
    const hasSlowIssue = issues.some((i) => i.issueType === QualityIssueType.PACING_TOO_SLOW);
    const hasFastIssue = issues.some((i) => i.issueType === QualityIssueType.PACING_TOO_FAST);

    let score = 0.8;
    if (eventCount < PACING_MIN_EVENTS_PER_CHAPTER) score = 0.5;
    if (eventCount > PACING_MAX_EVENTS_PER_CHAPTER) score = 0.6;
    if (hasSlowIssue) score = Math.min(score, 0.5);
    if (hasFastIssue) score = Math.min(score, 0.6);

    // Penalize for missing word count
    if (wordCount > 0 && wordCount < 500) score *= 0.8;

    return {
      score: Math.round(score * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.pacing,
      issues: issueIds,
      trend: hasSlowIssue || hasFastIssue ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreCharacterProgression(
    memory: ChapterMemory | undefined,
    previousMemories: ChapterMemory[],
    storyState: StoryState | undefined,
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.CHARACTER_STAGNATION ||
          i.issueType === QualityIssueType.CHARACTER_BEHAVIOR_DRIFT
      )
      .map((i) => i.id);

    const hasStagnation = issues.some((i) => i.issueType === QualityIssueType.CHARACTER_STAGNATION);
    const hasDrift = issues.some((i) => i.issueType === QualityIssueType.CHARACTER_BEHAVIOR_DRIFT);

    let score = 0.75;
    if (memory?.introducedCharacters && memory.introducedCharacters.length > 0) score += 0.1;
    if (memory?.changedRelationships && memory.changedRelationships.length > 0) score += 0.05;
    if (memory?.emotionalTurningPoints && memory.emotionalTurningPoints.length > 0) score += 0.05;
    if (hasStagnation) score = Math.min(score, 0.45);
    if (hasDrift) score -= 0.15;

    score = Math.max(0, Math.min(1, score));

    return {
      score: Math.round(score * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.characterProgression,
      issues: issueIds,
      trend: hasStagnation ? 'DEGRADING' : hasDrift ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scorePlotProgression(
    memory: ChapterMemory | undefined,
    previousMemories: ChapterMemory[],
    threads: PlotThreadState[],
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.PLOT_STAGNATION ||
          i.issueType === QualityIssueType.CONFLICT_ESCALATION_FAILURE
      )
      .map((i) => i.id);

    const hasStagnation = issues.some((i) => i.issueType === QualityIssueType.PLOT_STAGNATION);
    const hasEscalationFail = issues.some(
      (i) => i.issueType === QualityIssueType.CONFLICT_ESCALATION_FAILURE
    );

    let score = 0.75;
    if (memory?.resolvedThreads && memory.resolvedThreads.length > 0) score += 0.1;
    if (memory?.revelations && memory.revelations.length > 0) score += 0.05;

    const highPriorityThreads = threads.filter((t) => t.priority >= 7 && t.status === 'ACTIVE');
    if (highPriorityThreads.length > 0) score += 0.05;

    if (hasStagnation) score = Math.min(score, 0.4);
    if (hasEscalationFail) score -= 0.15;

    score = Math.max(0, Math.min(1, score));

    return {
      score: Math.round(score * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.plotProgression,
      issues: issueIds,
      trend: hasStagnation || hasEscalationFail ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreTension(
    memory: ChapterMemory | undefined,
    threads: PlotThreadState[],
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.LOW_TENSION ||
          i.issueType === QualityIssueType.LOW_STAKES
      )
      .map((i) => i.id);

    const hasLowTension = issues.some((i) => i.issueType === QualityIssueType.LOW_TENSION);
    const hasLowStakes = issues.some((i) => i.issueType === QualityIssueType.LOW_STAKES);

    let score = 0.7;
    const activeConflicts = threads.filter((t) => t.status === 'ACTIVE').length;
    if (activeConflicts > 0) score += Math.min(0.2, activeConflicts * 0.05);
    if (memory?.emotionalTurningPoints?.length) score += 0.05;

    if (hasLowTension) score = Math.min(score, 0.4);
    if (hasLowStakes) score -= 0.1;

    return {
      score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
      weight: DEFAULT_WEIGHTS.tension,
      issues: issueIds,
      trend: hasLowTension || hasLowStakes ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreNovelty(
    memory: ChapterMemory | undefined,
    previousMemories: ChapterMemory[],
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.REPETITION ||
          i.issueType === QualityIssueType.SCENE_REPETITION ||
          i.issueType === QualityIssueType.DIALOGUE_REPETITION ||
          i.issueType === QualityIssueType.DESCRIPTION_REPETITION
      )
      .map((i) => i.id);

    const repetitionCount = issueIds.length;
    const hasRepetition = repetitionCount > 0;

    let score = 0.75;
    if (memory?.introducedCharacters?.length) score += 0.05;
    if (memory?.locations?.length) score += 0.05;
    if (hasRepetition) score = Math.max(0, score - repetitionCount * 0.15);

    return {
      score: Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.novelty,
      issues: issueIds,
      trend: hasRepetition ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreScenePurpose(
    sceneCount: number,
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter((i) => i.issueType === QualityIssueType.WEAK_SCENE_PURPOSE)
      .map((i) => i.id);

    const weakPurposeCount = issueIds.length;
    const score = sceneCount === 0
      ? 0.5
      : Math.max(0, 1.0 - (weakPurposeCount / Math.max(sceneCount, 1)) * 0.5);

    return {
      score: Math.round(score * 1000) / 1000,
      weight: DEFAULT_WEIGHTS.scenePurpose,
      issues: issueIds,
      trend: weakPurposeCount > 0 ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreThreadProgression(
    threads: PlotThreadState[],
    memory: ChapterMemory | undefined,
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.THREAD_NEGLECT ||
          i.issueType === QualityIssueType.THREAD_OVERLOAD
      )
      .map((i) => i.id);

    const hasNeglect = issues.some((i) => i.issueType === QualityIssueType.THREAD_NEGLECT);
    const hasOverload = issues.some((i) => i.issueType === QualityIssueType.THREAD_OVERLOAD);

    let score = 0.75;
    if (memory?.resolvedThreads?.length) score += 0.1;
    if (memory?.unresolvedThreads?.length) {
      const ratio = memory.unresolvedThreads.length / Math.max(threads.length, 1);
      if (ratio > 0.8) score -= 0.1;
    }
    if (hasNeglect) score -= 0.2;
    if (hasOverload) score -= 0.15;

    return {
      score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
      weight: DEFAULT_WEIGHTS.threadProgression,
      issues: issueIds,
      trend: hasNeglect || hasOverload ? 'DEGRADING' : 'STABLE',
    };
  }

  private static scoreSetupPayoff(
    memory: ChapterMemory | undefined,
    previousMemories: ChapterMemory[],
    issues: QualityIssue[]
  ): QualityDimension {
    const issueIds = issues
      .filter(
        (i) =>
          i.issueType === QualityIssueType.UNSATISFIED_SETUP ||
          i.issueType === QualityIssueType.UNSATISFIED_PAYOFF
      )
      .map((i) => i.id);

    const hasSetupIssue = issues.some((i) => i.issueType === QualityIssueType.UNSATISFIED_SETUP);
    const hasPayoffIssue = issues.some((i) => i.issueType === QualityIssueType.UNSATISFIED_PAYOFF);

    let score = 0.8;
    if (hasSetupIssue) score -= 0.2;
    if (hasPayoffIssue) score -= 0.2;

    return {
      score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
      weight: DEFAULT_WEIGHTS.setupPayoffHealth,
      issues: issueIds,
      trend: hasSetupIssue || hasPayoffIssue ? 'DEGRADING' : 'STABLE',
    };
  }

  // ====================================================================
  // Helpers
  // ====================================================================

  private static deriveHealthStatus(
    score: QualityScore,
    trend?: QualityTrend
  ): QualityHealthStatus {
    if (trend) return trend.healthStatus;

    if (score.overall < 0.3) return QualityHealthStatus.CRITICAL;
    if (score.overall < 0.45) return QualityHealthStatus.DEGRADING;
    if (score.overall < 0.6) return QualityHealthStatus.STAGNANT;
    return QualityHealthStatus.HEALTHY;
  }

  static buildCorrelationId(novelId: string, chapterNumber: number | undefined, ts: Date): string {
    return createHash('sha256')
      .update(`${novelId}:${chapterNumber ?? 0}:${ts.toISOString()}`)
      .digest('hex')
      .slice(0, 24);
  }

  static buildIssueId(
    novelId: string,
    chapterNumber: number | undefined,
    issueType: string,
    entityId = ''
  ): string {
    return createHash('sha256')
      .update(`${novelId}:${chapterNumber ?? 0}:${issueType}:${entityId}`)
      .digest('hex')
      .slice(0, 24);
  }

  private static emptyTrend(novelId: string): QualityTrend {
    return {
      novelId,
      windowStart: 0,
      windowEnd: 0,
      scores: [],
      direction: 'STABLE',
      consecutiveDrops: 0,
      consecutiveLowScores: 0,
      healthStatus: QualityHealthStatus.HEALTHY,
      recoveryDetected: false,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      computedAt: new Date(),
    };
  }

  static get MIN_IMPROVEMENT_DELTA(): number {
    return MIN_IMPROVEMENT_DELTA;
  }

  static get LOW_SCORE_THRESHOLD(): number {
    return LOW_SCORE_THRESHOLD;
  }

  static get THREAD_OVERLOAD_COUNT(): number {
    return THREAD_OVERLOAD_COUNT;
  }

  static get THREAD_NEGLECT_CHAPTERS(): number {
    return THREAD_NEGLECT_CHAPTERS;
  }
}
