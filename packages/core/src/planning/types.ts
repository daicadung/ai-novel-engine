import { z } from 'zod';

// ====================================================================
// Arc Status
// ====================================================================

export enum ArcStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  ABANDONED = 'ABANDONED',
}

// ====================================================================
// Milestone Status
// ====================================================================

export enum MilestoneStatus {
  PLANNED = 'PLANNED',
  AVAILABLE = 'AVAILABLE',      // prerequisites met, can trigger
  TRIGGERED = 'TRIGGERED',     // currently unfolding
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  INVALIDATED = 'INVALIDATED', // canonical events made it impossible
}

export enum MilestoneType {
  MAJOR_REVEAL = 'MAJOR_REVEAL',
  BETRAYAL = 'BETRAYAL',
  DEATH = 'DEATH',
  ALLIANCE = 'ALLIANCE',
  DISCOVERY = 'DISCOVERY',
  TRANSFORMATION = 'TRANSFORMATION',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT',
  LOCATION_CHANGE = 'LOCATION_CHANGE',
  RELATIONSHIP_TURNING_POINT = 'RELATIONSHIP_TURNING_POINT',
  CONFLICT_ESCALATION = 'CONFLICT_ESCALATION',
  RESOLUTION = 'RESOLUTION',
  PROPHECY_FULFILLMENT = 'PROPHECY_FULFILLMENT',
  CHARACTER_DEATH = 'CHARACTER_DEATH',
  WORLD_EVENT = 'WORLD_EVENT',
}

// ====================================================================
// Obligation Status
// ====================================================================

export enum ObligationStatus {
  OPEN = 'OPEN',
  PROGRESSING = 'PROGRESSING',
  SATISFIED = 'SATISFIED',
  FAILED = 'FAILED',
  INVALIDATED = 'INVALIDATED',
}

export enum ObligationType {
  UNANSWERED_QUESTION = 'UNANSWERED_QUESTION',
  UNRESOLVED_MYSTERY = 'UNRESOLVED_MYSTERY',
  CHARACTER_PROMISE = 'CHARACTER_PROMISE',
  THREAT = 'THREAT',
  PROPHECY = 'PROPHECY',
  ITEM_SIGNIFICANCE = 'ITEM_SIGNIFICANCE',
  RELATIONSHIP_PROMISE = 'RELATIONSHIP_PROMISE',
  UNRESOLVED_CONSEQUENCE = 'UNRESOLVED_CONSEQUENCE',
  FORESHADOWING_PAYOFF = 'FORESHADOWING_PAYOFF',
}

// ====================================================================
// Foreshadowing Status
// ====================================================================

export enum ForeshadowingStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',       // setup delivered
  PAID_OFF = 'PAID_OFF',
  FORGOTTEN = 'FORGOTTEN', // setup delivered, payoff missed
  CANCELLED = 'CANCELLED',
}

export enum ForeshadowingStrength {
  SUBTLE = 'SUBTLE',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG',
}

// ====================================================================
// Deviation Type
// ====================================================================

export enum DeviationType {
  ON_PLAN = 'ON_PLAN',
  MINOR_DEVIATION = 'MINOR_DEVIATION',
  ADAPTABLE_DEVIATION = 'ADAPTABLE_DEVIATION',
  MAJOR_DEVIATION = 'MAJOR_DEVIATION',
  PLAN_INVALID = 'PLAN_INVALID',
}

// ====================================================================
// Arc Completion Result
// ====================================================================

export enum ArcCompletionResult {
  COMPLETE = 'COMPLETE',
  EXTEND = 'EXTEND',
  FAIL = 'FAIL',
  REPLAN = 'REPLAN',
}

// ====================================================================
// Story Plan (phase 11 overlay on existing StoryPlan)
// ====================================================================

export interface LongHorizonPlan {
  id: string;
  novelId: string;
  storyPlanVersionId: string;  // links to existing StoryPlanVersion
  version: number;
  title: string;
  premise: string;
  genre?: string;
  narrativePromise: string;    // the core promise to the reader
  globalObjective: string;     // what the novel ultimately achieves
  activeArcId?: string;
  plannedArcCount: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// Story Arc (phase 11 detailed arc plan)
// ====================================================================

export interface StoryArcPlan {
  id: string;
  longHorizonPlanId: string;
  novelId: string;
  arcNumber: number;
  title: string;
  purpose: string;
  objective: string;
  conflict: string;
  stakes: string;
  entryConditions: string[];
  exitConditions: string[];    // what must happen for arc to complete
  plannedChapterStart: number;
  plannedChapterEnd: number;
  actualChapterStart?: number;
  actualChapterEnd?: number;
  status: ArcStatus;
  priority: number;           // 1–10
  allowExtension: boolean;
  maxExtensionChapters: number;
  characterFocusIds: string[];
  threadFocusIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// Chapter Objective
// ====================================================================

export interface ChapterObjective {
  id: string;
  novelId: string;
  chapterNumber: number;
  arcPlanId: string;
  primaryObjective: string;
  secondaryObjectives: string[];
  requiredEvents: string[];       // must happen
  forbiddenEvents: string[];      // must NOT happen (canonical safety)
  characterGoals: Array<{
    characterId: string;
    goal: string;
  }>;
  plotThreadGoals: Array<{
    threadId: string;
    advancement: string;
  }>;
  requiredStateChanges: Array<{
    entityType: string;
    entityId: string;
    property: string;
    expectedValue: string;
  }>;
  setupActions: string[];         // foreshadowing to plant this chapter
  payoffActions: string[];        // foreshadowing to pay off this chapter
  tensionTarget: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  endingTarget: string;
  dependencies: string[];         // chapterObjective IDs this depends on
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'SUPERSEDED';
  completionScore?: number;       // 0.0–1.0 after reconciliation
  createdAt: Date;
}

// ====================================================================
// Character Arc Plan (phase 11 enhancement)
// ====================================================================

export interface CharacterArcPlanDetail {
  id: string;
  novelId: string;
  characterId: string;
  storyArcPlanId?: string;
  startingState: string;
  currentState: string;
  targetState: string;
  milestones: Array<{
    id: string;
    description: string;
    plannedChapter?: number;
    achieved: boolean;
    achievedChapter?: number;
  }>;
  internalConflict: string;
  externalConflict: string;
  relationshipMilestones: Array<{
    targetCharacterId: string;
    milestone: string;
    plannedChapter?: number;
    achieved: boolean;
  }>;
  turningPoints: Array<{
    description: string;
    plannedChapter?: number;
    triggered: boolean;
  }>;
  resolutionCriteria: string;
  status: 'ACTIVE' | 'COMPLETED' | 'BLOCKED' | 'ABANDONED';
  progressScore: number;  // 0.0–1.0
  updatedAt: Date;
}

// ====================================================================
// Narrative Milestone
// ====================================================================

export interface NarrativeMilestone {
  /** Stable deterministic ID */
  id: string;
  novelId: string;
  arcPlanId?: string;
  milestoneType: MilestoneType;
  title: string;
  description: string;
  plannedChapterMin: number;
  plannedChapterMax: number;
  actualChapter?: number;
  status: MilestoneStatus;
  prerequisites: string[];     // milestone IDs
  consequences: string[];      // what this enables or triggers
  involvedEntityIds: string[];
  priority: number;            // 1–10
  isOptional: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// Foreshadowing Plan
// ====================================================================

export interface ForeshadowingPlanRecord {
  id: string;
  novelId: string;
  targetMilestoneId?: string;
  targetObligationId?: string;
  setupType: string;
  plannedSetupChapters: number[];
  minimumOccurrences: number;
  actualSetupCount: number;
  revealWindowStart: number;
  revealWindowEnd: number;
  payoffWindowStart: number;
  payoffWindowEnd: number;
  strength: ForeshadowingStrength;
  status: ForeshadowingStatus;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// Narrative Obligation
// ====================================================================

export interface NarrativeObligation {
  id: string;
  novelId: string;
  obligationType: ObligationType;
  description: string;
  establishedChapter: number;
  establishedBy: string;           // what created the obligation
  targetResolutionChapter?: number;
  latestResolutionChapter?: number;
  status: ObligationStatus;
  progressNotes: string[];
  involvedEntityIds: string[];
  dependentObligationIds: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// Plan Reconciliation Result
// ====================================================================

export interface PlanReconciliationResult {
  novelId: string;
  chapterNumber: number;
  chapterObjectiveId: string;
  deviationType: DeviationType;
  objectiveCompletionScore: number;  // 0.0–1.0
  completedRequiredEvents: string[];
  missedRequiredEvents: string[];
  forbiddenEventsTriggered: string[];
  milestonesTriggered: string[];
  milestonesInvalidated: string[];
  obligationsProgressed: string[];
  obligationsSatisfied: string[];
  foreshadowingDelivered: string[];
  foreshadowingPaidOff: string[];
  requiresReplanning: boolean;
  replanningReason?: string;
  createdAt: Date;
}

// ====================================================================
// Planning Quality Score
// ====================================================================

export interface PlanningQualityScore {
  novelId: string;
  chapterNumber?: number;
  objectiveClarity: number;      // 0.0–1.0
  milestoneProgression: number;
  obligationHealth: number;
  foreshadowingHealth: number;
  characterArcProgression: number;
  plotProgression: number;
  planAdherence: number;
  adaptability: number;
  overall: number;
  computedAt: Date;
}

// ====================================================================
// Planning Window Context
// ====================================================================

export interface PlanningWindowContext {
  novelId: string;
  currentChapter: number;
  activeArcPlan?: StoryArcPlan;
  upcomingMilestones: NarrativeMilestone[];
  recentChapterSummaries: string[];   // bounded
  openObligations: NarrativeObligation[];
  pendingForeshadowing: ForeshadowingPlanRecord[];
  activeCharacterArcs: CharacterArcPlanDetail[];
  activeThreadTitles: string[];
  qualityTrend?: string;              // HEALTHY | DEGRADING | CRITICAL
  windowChapters: number;
  computedAt: Date;
}

// ====================================================================
// Narrative Balance
// ====================================================================

export interface NarrativeBalance {
  novelId: string;
  windowStart: number;
  windowEnd: number;
  mainPlotRatio: number;         // 0.0–1.0
  sidePlotRatio: number;
  characterFocusDistribution: Record<string, number>;
  threadDistribution: Record<string, number>;
  setupPayoffRatio: number;
  actionVsReflectionRatio: number;
  imbalances: NarrativeImbalance[];
  overallBalance: number;
  computedAt: Date;
}

export interface NarrativeImbalance {
  dimension: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  suggestedCorrection: string;
}

// ====================================================================
// Planning Decision Log
// ====================================================================

export interface PlanningDecision {
  id: string;
  novelId: string;
  decisionType: string;
  summary: string;
  rationale: string;
  previousState: Record<string, any>;
  newState: Record<string, any>;
  affectedArcIds: string[];
  affectedChapterRange: [number, number];
  wasLLMAssisted: boolean;
  validationPassed: boolean;
  createdAt: Date;
}
