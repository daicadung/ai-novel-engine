export enum CausalEventType {
  STATE_CHANGE = 'STATE_CHANGE',
  CHARACTER_DEATH = 'CHARACTER_DEATH',
  CHARACTER_SPAWN = 'CHARACTER_SPAWN',
  LOCATION_DESTROYED = 'LOCATION_DESTROYED',
  ITEM_DESTROYED = 'ITEM_DESTROYED',
  FACTION_DEFEATED = 'FACTION_DEFEATED',
  RELATIONSHIP_CHANGED = 'RELATIONSHIP_CHANGED',
  KNOWLEDGE_REVEALED = 'KNOWLEDGE_REVEALED',
  POLITICAL_CHANGE = 'POLITICAL_CHANGE',
  GENERIC = 'GENERIC',
}

export enum RelationType {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT',
  CONDITIONAL = 'CONDITIONAL',
  ENABLING = 'ENABLING',
  PREVENTING = 'PREVENTING',
  REINFORCING = 'REINFORCING',
  CONTRADICTING = 'CONTRADICTING',
}

export enum ConsequenceType {
  PLAN_IMPACT = 'PLAN_IMPACT',
  WORLD_CHANGE = 'WORLD_CHANGE',
  RELATIONSHIP_CHANGE = 'RELATIONSHIP_CHANGE',
  KNOWLEDGE_SPREAD = 'KNOWLEDGE_SPREAD',
  THREAT_ESCALATION = 'THREAT_ESCALATION',
  GENERIC = 'GENERIC',
}

export enum ImportanceLevel {
  TRIVIAL = 'TRIVIAL',
  MINOR = 'MINOR',
  SIGNIFICANT = 'SIGNIFICANT',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export enum ConsequenceStatus {
  PREDICTED = 'PREDICTED',
  ACTIVE = 'ACTIVE',
  REALIZED = 'REALIZED',
  INVALIDATED = 'INVALIDATED',
  RESOLVED = 'RESOLVED',
}

export enum DependencyType {
  ACCESS = 'ACCESS',
  KNOWLEDGE = 'KNOWLEDGE',
  OWNERSHIP = 'OWNERSHIP',
  STATUS = 'STATUS',
  SURVIVAL = 'SURVIVAL',
}

export enum DependencyStatus {
  ACTIVE = 'ACTIVE',
  SATISFIED = 'SATISFIED',
  INVALIDATED = 'INVALIDATED',
}

export enum WorldTransitionType {
  TERRITORY_CHANGE = 'TERRITORY_CHANGE',
  LOCATION_STATE_CHANGE = 'LOCATION_STATE_CHANGE',
  OWNERSHIP_CHANGE = 'OWNERSHIP_CHANGE',
  POLITICAL_SHIFT = 'POLITICAL_SHIFT',
  ENVIRONMENTAL_CHANGE = 'ENVIRONMENTAL_CHANGE',
  GENERIC = 'GENERIC',
}

export enum CausalAnalysisType {
  POST_CHAPTER_EVALUATION = 'POST_CHAPTER_EVALUATION',
  COUNTERFACTUAL = 'COUNTERFACTUAL',
  QUALITY_CHECK = 'QUALITY_CHECK',
}

export interface CausalEvent {
  id: string;
  novelId: string;
  chapterNumber: number;
  sceneId?: string;
  eventType: CausalEventType | string;
  actorIds: string[];
  targetIds: string[];
  locationId?: string;
  stateChanges: any[]; // StateDelta[]
  importance: ImportanceLevel;
  provenance: string;
  createdAt: Date;
}

export interface CausalRelation {
  id: string;
  novelId: string;
  causeEventId: string;
  effectEventId: string;
  relationType: RelationType | string;
  strength: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  temporalConstraint?: string;
  provenance: string;
  createdAt: Date;
}

export interface Consequence {
  id: string;
  novelId: string;
  sourceEventId: string;
  consequenceType: ConsequenceType | string;
  targetEntityId?: string;
  expectedChapterRange?: { min: number; max: number };
  severity: number; // 0.0 to 1.0
  probability: number; // 0.0 to 1.0
  status: ConsequenceStatus | string;
  description: string;
  provenance: string;
  createdAt: Date;
}

export interface WorldTransition {
  id: string;
  novelId: string;
  entityId: string;
  transitionType: WorldTransitionType | string;
  beforeState: any;
  afterState: any;
  causeEventId: string;
  chapterNumber: number;
  reversible: boolean;
  provenance: string;
  createdAt: Date;
}

export interface CausalDependency {
  id: string;
  novelId: string;
  prerequisite: string; // Describes the condition
  dependentEntityId: string; // The entity/plan constrained by this
  dependencyType: DependencyType | string;
  status: DependencyStatus | string;
  provenance: string;
  createdAt: Date;
}

export interface PlanImpactReport {
  id: string;
  novelId: string;
  causalEventId: string;
  affectedArcId?: string;
  affectedObjectiveIds: string[];
  affectedMilestoneIds: string[];
  affectedObligationIds: string[];
  affectedCharacterArcIds: string[];
  severity: string; // LOW, MEDIUM, HIGH, CRITICAL
  recommendedAction: 'NO_CHANGE' | 'UPDATE_OBJECTIVE' | 'UPDATE_MILESTONE' | 'INVALIDATE_PLAN' | 'REPLAN';
  reasoning: string;
  createdAt: Date;
}

export interface CausalAnalysis {
  id: string;
  novelId: string;
  chapterNumber: number;
  analysisType: CausalAnalysisType | string;
  eventsGenerated: number;
  consequencesGenerated: number;
  dependenciesInvalidated: number;
  worldTransitionsGenerated: number;
  planImpactsGenerated: number;
  healthScoreId?: string;
  executionMs: number;
  createdAt: Date;
}

export interface CausalHealthScore {
  id: string;
  novelId: string;
  chapterNumber: number;
  orphanConsequences: number;
  unresolvedMajorConsequences: number;
  causalContradictions: number;
  ignoredReactions: number;
  staleDependencies: number;
  impossibleDependencies: number;
  overallHealth: number; // 0.0 to 1.0
  createdAt: Date;
}

export interface CausalContext {
  recentSignificantEvents: CausalEvent[];
  unresolvedConsequences: Consequence[];
  activeDependencies: CausalDependency[];
  pendingReactions: any[]; // Specific pending world reactions
  relevantAffectedEntities: string[];
}
