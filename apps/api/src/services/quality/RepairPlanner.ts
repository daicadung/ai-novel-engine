import { createHash } from 'node:crypto';
import {
  QualityIssue,
  QualityIssueType,
  QualityIssueSeverity,
  RepairPlan,
  RepairDecision,
  RepairStrategy,
  QualityRepairBudget,
  QualityScore,
  RepairComparison,
  RepairAttemptRecord,
  RepairOutcome,
} from '@ane/core';
import { QualityScoringEngine } from './QualityScoringEngine.js';
import { QualityMemoryService } from './QualityMemoryService.js';

// Default budget (all env-configurable)
const DEFAULT_BUDGET: QualityRepairBudget = {
  maxRepairsPerChapter: parseInt(process.env.QUALITY_MAX_REPAIRS_PER_CHAPTER ?? '3', 10),
  maxRepairsPerArc: parseInt(process.env.QUALITY_MAX_REPAIRS_PER_ARC ?? '10', 10),
  maxLLMRepairAttempts: parseInt(process.env.QUALITY_MAX_LLM_REPAIRS ?? '5', 10),
  maxTokensPerRepair: parseInt(process.env.QUALITY_MAX_TOKENS_PER_REPAIR ?? '8000', 10),
  maxCostUsdPerRepair: parseFloat(process.env.QUALITY_MAX_COST_PER_REPAIR ?? '0.50'),
  minQualityImprovement: parseFloat(process.env.QUALITY_MIN_IMPROVEMENT ?? '0.05'),
};

const MAX_CONSECUTIVE_REPAIRS = parseInt(process.env.QUALITY_MAX_CONSECUTIVE ?? '5', 10);
const MAX_ATTEMPTS_PER_VERSION = parseInt(process.env.QUALITY_MAX_ATTEMPTS_PER_VERSION ?? '3', 10);

/**
 * RepairPlanner
 *
 * Receives detected quality issues and determines the appropriate repair decision.
 * NEVER mutates canonical state.
 * NEVER calls LLMs.
 * Enforces repair budgets and loop protection.
 */
export class RepairPlanner {
  static async plan(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    chapterProseVersionId: string,
    issues: QualityIssue[],
    currentScore: number,
    budget: QualityRepairBudget = DEFAULT_BUDGET
  ): Promise<RepairPlan> {
    const planId = this.buildPlanId(novelId, chapterNumber, chapterProseVersionId);

    // ---- Loop protection checks ----
    const attemptCount = await QualityMemoryService.countRepairAttempts(
      novelId,
      chapterId,
      chapterProseVersionId
    );

    if (attemptCount >= MAX_ATTEMPTS_PER_VERSION) {
      return this.buildPlan(planId, novelId, chapterId, chapterNumber, issues, {
        decision: 'DEFER',
        reason: `Max repair attempts per prose version reached (${attemptCount}/${MAX_ATTEMPTS_PER_VERSION})`,
        primaryStrategy: 'DEFER',
        budgetApproved: false,
      });
    }

    const totalAttempts = await QualityMemoryService.countRepairAttempts(novelId, chapterId);
    if (totalAttempts >= budget.maxRepairsPerChapter) {
      return this.buildPlan(planId, novelId, chapterId, chapterNumber, issues, {
        decision: 'DEFER',
        reason: `Max repairs per chapter reached (${totalAttempts}/${budget.maxRepairsPerChapter})`,
        primaryStrategy: 'DEFER',
        budgetApproved: false,
      });
    }

    // ---- No significant issues ----
    if (issues.length === 0) {
      return this.buildPlan(planId, novelId, chapterId, chapterNumber, issues, {
        decision: 'NO_REPAIR',
        reason: 'No quality issues detected',
        primaryStrategy: 'NONE',
        budgetApproved: true,
      });
    }

    // ---- Classify issues by severity ----
    const criticalIssues = issues.filter((i) => i.severity === QualityIssueSeverity.CRITICAL);
    const highIssues = issues.filter((i) => i.severity === QualityIssueSeverity.HIGH);
    const mediumIssues = issues.filter((i) => i.severity === QualityIssueSeverity.MEDIUM);

    // ---- BLOCK condition: critical unresolvable issues ----
    const blockingIssues = criticalIssues.filter(
      (i) =>
        i.issueType === QualityIssueType.CONTINUITY_CONFLICT ||
        i.issueType === QualityIssueType.KNOWLEDGE_INCONSISTENCY
    );

    if (blockingIssues.length > 0) {
      return this.buildPlan(planId, novelId, chapterId, chapterNumber, issues, {
        decision: 'BLOCK',
        reason: `Critical blocking issues: ${blockingIssues.map((i) => i.issueType).join(', ')}`,
        primaryStrategy: 'CONTINUITY_SAFE_REGEN',
        budgetApproved: true,
      });
    }

    // ---- Determine primary repair strategy ----
    const { strategy, requiresLLM } = this.selectStrategy(issues);

    // ---- Budget check ----
    const estimatedTokens = requiresLLM ? budget.maxTokensPerRepair : 0;
    const estimatedCost = requiresLLM ? budget.maxCostUsdPerRepair * 0.5 : 0;
    const budgetApproved =
      estimatedCost <= budget.maxCostUsdPerRepair &&
      estimatedTokens <= budget.maxTokensPerRepair;

    if (!budgetApproved) {
      return this.buildPlan(planId, novelId, chapterId, chapterNumber, issues, {
        decision: 'DEFER',
        reason: `Repair budget exceeded. Estimated: $${estimatedCost}`,
        primaryStrategy: 'DEFER',
        budgetApproved: false,
        estimatedTokens,
        estimatedCost,
      });
    }

    const decision: RepairDecision = requiresLLM ? 'LLM_ASSISTED_REPAIR' : 'DETERMINISTIC_REPAIR';

    const targetDimensions = this.identifyTargetDimensions(issues);

    return {
      id: planId,
      novelId,
      chapterId,
      chapterNumber,
      decision,
      issues,
      primaryStrategy: strategy,
      targetDimensions,
      estimatedTokens,
      estimatedCostUsd: estimatedCost,
      budgetApproved: true,
      reason: `${issues.length} issues detected. Primary: ${strategy}. Decision: ${decision}`,
      createdAt: new Date(),
    };
  }

  // ====================================================================
  // Select best repair strategy from issue set
  // ====================================================================
  private static selectStrategy(issues: QualityIssue[]): {
    strategy: RepairStrategy;
    requiresLLM: boolean;
  } {
    // Priority order for strategy selection
    const prioritized = [...issues].sort((a, b) => {
      const severityOrder = {
        [QualityIssueSeverity.CRITICAL]: 0,
        [QualityIssueSeverity.HIGH]: 1,
        [QualityIssueSeverity.MEDIUM]: 2,
        [QualityIssueSeverity.LOW]: 3,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const primary = prioritized[0];
    return {
      strategy: primary.suggestedRepairStrategy,
      requiresLLM: primary.requiresLLM,
    };
  }

  private static identifyTargetDimensions(issues: QualityIssue[]): string[] {
    const dimensions = new Set<string>();
    for (const issue of issues) {
      switch (issue.issueType) {
        case QualityIssueType.CONTINUITY_CONFLICT:
        case QualityIssueType.KNOWLEDGE_INCONSISTENCY:
          dimensions.add('continuity');
          break;
        case QualityIssueType.PACING_TOO_FAST:
        case QualityIssueType.PACING_TOO_SLOW:
          dimensions.add('pacing');
          break;
        case QualityIssueType.CHARACTER_STAGNATION:
        case QualityIssueType.CHARACTER_BEHAVIOR_DRIFT:
          dimensions.add('characterProgression');
          break;
        case QualityIssueType.PLOT_STAGNATION:
        case QualityIssueType.THREAD_NEGLECT:
        case QualityIssueType.THREAD_OVERLOAD:
        case QualityIssueType.CONFLICT_ESCALATION_FAILURE:
          dimensions.add('plotProgression');
          dimensions.add('threadProgression');
          break;
        case QualityIssueType.REPETITION:
        case QualityIssueType.SCENE_REPETITION:
        case QualityIssueType.DIALOGUE_REPETITION:
        case QualityIssueType.DESCRIPTION_REPETITION:
          dimensions.add('novelty');
          break;
        case QualityIssueType.LOW_TENSION:
        case QualityIssueType.LOW_STAKES:
          dimensions.add('tension');
          break;
        case QualityIssueType.WEAK_SCENE_PURPOSE:
          dimensions.add('scenePurpose');
          break;
        case QualityIssueType.UNSATISFIED_SETUP:
        case QualityIssueType.UNSATISFIED_PAYOFF:
          dimensions.add('setupPayoffHealth');
          break;
        case QualityIssueType.CHAPTER_ENDING_WEAK:
          dimensions.add('pacing');
          break;
        case QualityIssueType.ARC_IMBALANCE:
          dimensions.add('plotProgression');
          break;
      }
    }
    return Array.from(dimensions);
  }

  private static buildPlan(
    id: string,
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    issues: QualityIssue[],
    overrides: {
      decision: RepairDecision;
      reason: string;
      primaryStrategy: RepairStrategy;
      budgetApproved: boolean;
      estimatedTokens?: number;
      estimatedCost?: number;
    }
  ): RepairPlan {
    return {
      id,
      novelId,
      chapterId,
      chapterNumber,
      decision: overrides.decision,
      issues,
      primaryStrategy: overrides.primaryStrategy,
      targetDimensions: this.identifyTargetDimensions(issues),
      estimatedTokens: overrides.estimatedTokens ?? 0,
      estimatedCostUsd: overrides.estimatedCost ?? 0,
      budgetApproved: overrides.budgetApproved,
      reason: overrides.reason,
      createdAt: new Date(),
    };
  }

  static buildPlanId(
    novelId: string,
    chapterNumber: number,
    chapterProseVersionId: string
  ): string {
    return createHash('sha256')
      .update(`repair:${novelId}:${chapterNumber}:${chapterProseVersionId}:${Date.now()}`)
      .digest('hex')
      .slice(0, 24);
  }

  static buildAttemptId(planId: string, attemptNumber: number): string {
    return createHash('sha256')
      .update(`attempt:${planId}:${attemptNumber}`)
      .digest('hex')
      .slice(0, 24);
  }
}

/**
 * RepairEvaluator
 *
 * Compares original vs repair candidate.
 * Promotes only if candidate is better and introduces no regressions.
 * Pure, no DB, no LLM.
 */
export class RepairEvaluator {
  static compare(
    originalScore: QualityScore,
    candidateScore: QualityScore,
    budget: QualityRepairBudget = {
      maxRepairsPerChapter: 3,
      maxRepairsPerArc: 10,
      maxLLMRepairAttempts: 5,
      maxTokensPerRepair: 8000,
      maxCostUsdPerRepair: 0.5,
      minQualityImprovement: 0.05,
    }
  ): RepairComparison {
    const overallDelta = candidateScore.overall - originalScore.overall;

    const dimensionKeys = [
      'continuity',
      'pacing',
      'characterProgression',
      'plotProgression',
      'tension',
      'novelty',
      'scenePurpose',
      'threadProgression',
      'setupPayoffHealth',
    ] as const;

    const dimensionDiffs: Record<string, number> = {};
    const regressionDimensions: string[] = [];

    for (const key of dimensionKeys) {
      const origDim = (originalScore as any)[key] as { score: number } | undefined;
      const candDim = (candidateScore as any)[key] as { score: number } | undefined;
      if (origDim && candDim) {
        const diff = Math.round((candDim.score - origDim.score) * 1000) / 1000;
        dimensionDiffs[key] = diff;
        // Regression: dimension got significantly worse
        if (diff < -0.1) {
          regressionDimensions.push(key);
        }
      }
    }

    const hasRegressions = regressionDimensions.length > 0;
    const meetsMinThreshold = overallDelta >= budget.minQualityImprovement;

    const recommendation: 'PROMOTE' | 'REJECT' =
      meetsMinThreshold && !hasRegressions ? 'PROMOTE' : 'REJECT';

    return {
      isImprovement: overallDelta > 0,
      originalScore,
      candidateScore,
      dimensionDiffs,
      hasRegressions,
      regressionDimensions,
      overallDelta: Math.round(overallDelta * 1000) / 1000,
      meetsMinThreshold,
      recommendation,
    };
  }
}
