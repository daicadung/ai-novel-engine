import { z } from 'zod';

// ====================================================================
// Quality Issue Taxonomy
// ====================================================================

export enum QualityIssueType {
  // Repetition family
  REPETITION = 'REPETITION',
  SCENE_REPETITION = 'SCENE_REPETITION',
  DIALOGUE_REPETITION = 'DIALOGUE_REPETITION',
  DESCRIPTION_REPETITION = 'DESCRIPTION_REPETITION',

  // Pacing family
  PACING_TOO_FAST = 'PACING_TOO_FAST',
  PACING_TOO_SLOW = 'PACING_TOO_SLOW',

  // Character family
  CHARACTER_STAGNATION = 'CHARACTER_STAGNATION',
  CHARACTER_BEHAVIOR_DRIFT = 'CHARACTER_BEHAVIOR_DRIFT',

  // Plot family
  PLOT_STAGNATION = 'PLOT_STAGNATION',
  THREAD_NEGLECT = 'THREAD_NEGLECT',
  THREAD_OVERLOAD = 'THREAD_OVERLOAD',
  CONFLICT_ESCALATION_FAILURE = 'CONFLICT_ESCALATION_FAILURE',

  // Scene quality
  WEAK_SCENE_PURPOSE = 'WEAK_SCENE_PURPOSE',
  LOW_STAKES = 'LOW_STAKES',
  LOW_TENSION = 'LOW_TENSION',

  // Continuity
  KNOWLEDGE_INCONSISTENCY = 'KNOWLEDGE_INCONSISTENCY',
  CONTINUITY_CONFLICT = 'CONTINUITY_CONFLICT',

  // Narrative structure
  UNSATISFIED_SETUP = 'UNSATISFIED_SETUP',
  UNSATISFIED_PAYOFF = 'UNSATISFIED_PAYOFF',
  CHAPTER_ENDING_WEAK = 'CHAPTER_ENDING_WEAK',
  ARC_IMBALANCE = 'ARC_IMBALANCE',
}

export enum QualityIssueSeverity {
  CRITICAL = 'CRITICAL',   // Block or require immediate repair
  HIGH = 'HIGH',           // Repair recommended
  MEDIUM = 'MEDIUM',       // Track and repair if budget allows
  LOW = 'LOW',             // Log only
}

export type RepairStrategy =
  | 'REWRITE_SCENE'
  | 'REGENERATE_ENDING'
  | 'COMPRESS_SECTION'
  | 'INJECT_PROGRESSION'
  | 'INCORPORATE_THREAD'
  | 'CONTINUITY_SAFE_REGEN'
  | 'REGENERATE_SCENE_PURPOSE'
  | 'DEFER'
  | 'NONE';

export interface QualityIssue {
  /** Stable deterministic ID (hash of novelId+chapterNumber+issueType+entityId) */
  id: string;
  issueType: QualityIssueType;
  severity: QualityIssueSeverity;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  chapterId?: string;
  chapterNumber?: number;
  sceneId?: string;
  evidence: string[];
  affectedEntities: string[];   // entity IDs involved
  suggestedRepairStrategy: RepairStrategy;
  /** Can be repaired automatically without full LLM invocation */
  isAutomaticallyRepairable: boolean;
  /** Whether LLM assistance is needed */
  requiresLLM: boolean;
  /** Provenance — what detection module produced this */
  detectedBy: string;
  detectedAt: Date;
  /** Correlation to existing continuity conflicts */
  continuityConflictIds?: string[];
}

// ====================================================================
// Quality Score
// ====================================================================

export interface QualityDimension {
  score: number;           // 0.0–1.0
  weight: number;          // contribution weight
  issues: string[];        // QualityIssue IDs
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

export interface QualityScore {
  /** Overall weighted score 0.0–1.0 */
  overall: number;

  continuity: QualityDimension;
  pacing: QualityDimension;
  characterProgression: QualityDimension;
  plotProgression: QualityDimension;
  tension: QualityDimension;
  novelty: QualityDimension;
  scenePurpose: QualityDimension;
  threadProgression: QualityDimension;
  setupPayoffHealth: QualityDimension;

  /** Deterministic computation timestamp */
  computedAt: Date;
  chapterId?: string;
  chapterNumber?: number;
  novelId: string;
}

// ====================================================================
// Quality Trend
// ====================================================================

export enum QualityHealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADING = 'DEGRADING',
  STAGNANT = 'STAGNANT',
  CRITICAL = 'CRITICAL',
  RECOVERING = 'RECOVERING',
}

export interface QualityTrend {
  novelId: string;
  windowStart: number;   // chapter number
  windowEnd: number;
  scores: Array<{ chapterNumber: number; overall: number }>;
  direction: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  consecutiveDrops: number;
  consecutiveLowScores: number;
  healthStatus: QualityHealthStatus;
  /** Recovery detected after N repairs */
  recoveryDetected: boolean;
  averageScore: number;
  minScore: number;
  maxScore: number;
  computedAt: Date;
}

// ====================================================================
// Quality Snapshot
// ====================================================================

export interface QualitySnapshot {
  id: string;
  novelId: string;
  chapterId?: string;
  chapterNumber?: number;
  score: QualityScore;
  issues: QualityIssue[];
  trend?: QualityTrend;
  healthStatus: QualityHealthStatus;
  createdAt: Date;
  /** Deterministic correlation ID */
  correlationId: string;
}

// ====================================================================
// Repair Plan
// ====================================================================

export type RepairDecision =
  | 'NO_REPAIR'
  | 'DETERMINISTIC_REPAIR'
  | 'LLM_ASSISTED_REPAIR'
  | 'DEFER'
  | 'BLOCK';

export interface RepairPlan {
  id: string;
  novelId: string;
  chapterId: string;
  chapterNumber: number;
  decision: RepairDecision;
  issues: QualityIssue[];
  primaryStrategy: RepairStrategy;
  targetDimensions: string[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  /** Whether the budget allows this repair */
  budgetApproved: boolean;
  reason: string;
  createdAt: Date;
}

// ====================================================================
// Repair Attempt
// ====================================================================

export type RepairOutcome =
  | 'PROMOTED'
  | 'REJECTED'
  | 'FAILED'
  | 'BUDGET_EXCEEDED'
  | 'IDENTICAL_CANDIDATE'
  | 'OSCILLATION_DETECTED'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'DEFERRED';

export interface RepairAttemptRecord {
  id: string;
  novelId: string;
  chapterId: string;
  chapterProseVersionId: string;
  repairPlanId: string;
  strategy: RepairStrategy;
  attemptNumber: number;
  outcome: RepairOutcome;
  originalScore: number;
  candidateScore?: number;
  improvement?: number;
  /** Content fingerprint for identical-candidate detection */
  candidateFingerprint?: string;
  createdAt: Date;
}

// ====================================================================
// Repair Comparison
// ====================================================================

export interface RepairComparison {
  isImprovement: boolean;
  originalScore: QualityScore;
  candidateScore: QualityScore;
  dimensionDiffs: Record<string, number>;   // dimension → delta (positive = improvement)
  hasRegressions: boolean;
  regressionDimensions: string[];
  overallDelta: number;
  meetsMinThreshold: boolean;
  recommendation: 'PROMOTE' | 'REJECT';
}

// ====================================================================
// Quality Budget
// ====================================================================

export interface QualityRepairBudget {
  maxRepairsPerChapter: number;
  maxRepairsPerArc: number;
  maxLLMRepairAttempts: number;
  maxTokensPerRepair: number;
  maxCostUsdPerRepair: number;
  minQualityImprovement: number;  // minimum delta to promote
}

// ====================================================================
// Repetition Fingerprint
// ====================================================================

export interface ContentFingerprint {
  id: string;
  chapterId: string;
  chapterNumber: number;
  sceneId?: string;
  fingerprint: string;   // deterministic hash of normalized content
  category: 'SCENE' | 'DIALOGUE' | 'DESCRIPTION' | 'ENDING' | 'BEAT';
  content: string;       // first ~200 chars for evidence
  createdAt: Date;
}
