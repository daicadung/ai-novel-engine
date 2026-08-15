import { z } from 'zod';

// ====================================================================
// Entity State (building blocks)
// ====================================================================

export const CharacterStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAlive: z.boolean().default(true),
  location: z.string().optional(),
  physicalState: z.record(z.string()).optional(), // injuries, enhancements, etc.
  abilities: z.array(z.string()).optional(),
  possessions: z.array(z.string()).optional(),
  emotionalState: z.string().optional(),
  goals: z.array(z.string()).optional(),
  secrets: z.array(z.string()).optional(),
  lastSeenChapter: z.number().optional(),
});

export const LocationStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAccessible: z.boolean().default(true),
  controlledBy: z.string().optional(),
  status: z.string().optional(),
  recentEvents: z.array(z.string()).optional(),
  lastChapter: z.number().optional(),
});

export const ItemStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string().optional(),
  ownerType: z.string().optional(),
  location: z.string().optional(),
  condition: z.string().optional(),
  isDestroyed: z.boolean().default(false),
  lastChapter: z.number().optional(),
});

export const FactionStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  power: z.string().optional(),
  controlledLocations: z.array(z.string()).optional(),
  allies: z.array(z.string()).optional(),
  enemies: z.array(z.string()).optional(),
  lastChapter: z.number().optional(),
});

export const PlotThreadStateSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['OPEN', 'ACTIVE', 'RESOLVED', 'ABANDONED', 'BLOCKED']),
  priority: z.number().min(0).max(10).default(5),
  participants: z.array(z.string()).optional(),
  introducedChapter: z.number().optional(),
  lastReferencedChapter: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const WorldFactSchema = z.object({
  id: z.string(),
  category: z.string(),
  fact: z.string(),
  establishedChapter: z.number().optional(),
  isRevoked: z.boolean().default(false),
});

export const SecretSchema = z.object({
  id: z.string(),
  description: z.string(),
  truth: z.string(),
  knownBy: z.array(z.string()),
  revealedInChapter: z.number().optional(),
  revealedInScene: z.string().optional(),
});

// ====================================================================
// Story State — the canonical "what is true now" representation
// ====================================================================

export const StoryStateSchema = z.object({
  novelId: z.string(),
  asOfChapter: z.number(),
  snapshotId: z.string().optional(),

  characters: z.record(CharacterStateSchema).default({}),
  relationships: z.record(z.object({
    sourceId: z.string(),
    targetId: z.string(),
    type: z.string(),
    dynamic: z.string().optional(),
    tension: z.string().optional(),
    lastChapter: z.number().optional(),
  })).default({}),
  locations: z.record(LocationStateSchema).default({}),
  items: z.record(ItemStateSchema).default({}),
  abilities: z.record(z.object({
    ownerId: z.string(),
    name: z.string(),
    level: z.string().optional(),
    limitations: z.array(z.string()).optional(),
  })).default({}),
  factions: z.record(FactionStateSchema).default({}),
  mysteries: z.record(SecretSchema).default({}),
  quests: z.record(PlotThreadStateSchema).default({}),
  worldFacts: z.record(WorldFactSchema).default({}),
  timeline: z.record(z.object({
    event: z.string(),
    chapter: z.number(),
    isPublicKnowledge: z.boolean().default(false),
  })).default({}),
  customEntities: z.record(z.unknown()).default({}),
});

export type StoryState = z.infer<typeof StoryStateSchema>;
export type CharacterState = z.infer<typeof CharacterStateSchema>;
export type LocationState = z.infer<typeof LocationStateSchema>;
export type ItemState = z.infer<typeof ItemStateSchema>;
export type FactionState = z.infer<typeof FactionStateSchema>;
export type PlotThreadState = z.infer<typeof PlotThreadStateSchema>;
export type WorldFact = z.infer<typeof WorldFactSchema>;
export type Secret = z.infer<typeof SecretSchema>;

// ====================================================================
// State Delta — typed state change with provenance
// ====================================================================

export enum EntityTypeEnum {
  CHARACTER = 'CHARACTER',
  LOCATION = 'LOCATION',
  ITEM = 'ITEM',
  FACTION = 'FACTION',
  RELATIONSHIP = 'RELATIONSHIP',
  ABILITY = 'ABILITY',
  WORLD_FACT = 'WORLD_FACT',
  PLOT_THREAD = 'PLOT_THREAD',
  SECRET = 'SECRET',
  TIMELINE = 'TIMELINE',
}

export interface StateDelta {
  entityType: EntityTypeEnum;
  entityId: string;
  property: string;
  previousValue: unknown;
  newValue: unknown;
  sourceSceneId?: string;
  sourceChapterId?: string;
  sourceChapterNumber?: number;
  reason?: string;
}

// ====================================================================
// Chapter Memory — compact structured chapter summary
// ====================================================================

export const ChapterMemorySchema = z.object({
  chapterId: z.string(),
  novelId: z.string(),
  chapterNumber: z.number(),
  summary: z.string().max(1500),
  keyEvents: z.array(z.string()).max(10),
  stateDeltas: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
    property: z.string(),
    newValue: z.string(),
  })).max(30),
  introducedCharacters: z.array(z.string()).max(10),
  changedRelationships: z.array(z.string()).max(10),
  revelations: z.array(z.string()).max(10),
  unresolvedThreads: z.array(z.string()).max(10),
  resolvedThreads: z.array(z.string()).max(10),
  locations: z.array(z.string()).max(10),
  importantItems: z.array(z.string()).max(10),
  emotionalTurningPoints: z.array(z.string()).max(5),
  povCharacter: z.string().optional(),
  createdAt: z.date().optional(),
});

export type ChapterMemory = z.infer<typeof ChapterMemorySchema>;

// ====================================================================
// Knowledge State — per-character knowledge model
// ====================================================================

export const KnowledgeStateSchema = z.object({
  characterId: z.string(),
  characterName: z.string(),
  knownFacts: z.array(z.string()),
  knownEntities: z.record(z.object({
    entityId: z.string(),
    knownAs: z.string(),
    relationship: z.string().optional(),
    beliefs: z.record(z.string()).optional(),
  })),
  knownSecrets: z.array(z.string()),
  beliefs: z.record(z.string()),
  misconceptions: z.array(z.object({
    belief: z.string(),
    truth: z.string(),
    introducedChapter: z.number().optional(),
  })),
  discoveredAtChapter: z.record(z.number()),
  lastUpdatedChapter: z.number(),
});

export type KnowledgeState = z.infer<typeof KnowledgeStateSchema>;

// ====================================================================
// Continuity Conflict types
// ====================================================================

export enum ContinuityConflictType {
  IMPOSSIBLE_LOCATION = 'IMPOSSIBLE_LOCATION',
  IMPOSSIBLE_POSSESSION = 'IMPOSSIBLE_POSSESSION',
  DEAD_CHARACTER = 'DEAD_CHARACTER',
  MISSING_INJURY = 'MISSING_INJURY',
  RELATIONSHIP_CONTRADICTION = 'RELATIONSHIP_CONTRADICTION',
  KNOWLEDGE_LEAK = 'KNOWLEDGE_LEAK',
  TIMELINE_CONTRADICTION = 'TIMELINE_CONTRADICTION',
  IMPOSSIBLE_ABILITY = 'IMPOSSIBLE_ABILITY',
  UNRESOLVED_DEPENDENCY = 'UNRESOLVED_DEPENDENCY',
  STATE_COLLISION = 'STATE_COLLISION',
  DUPLICATE_REVELATION = 'DUPLICATE_REVELATION',
  IMPOSSIBLE_WORLD_STATE = 'IMPOSSIBLE_WORLD_STATE',
  ORPHANED_THREAD = 'ORPHANED_THREAD',
}

export enum ConflictSeverity {
  ERROR = 'ERROR',   // Block canonical promotion
  WARNING = 'WARNING', // Allow with review flag
  INFO = 'INFO',     // Log only
}

export interface ContinuityConflict {
  type: ContinuityConflictType;
  severity: ConflictSeverity;
  entityId?: string;
  entityType?: string;
  description: string;
  source?: string;
  chapterNumber?: number;
  sceneId?: string;
  resolution?: string;
}

export interface ContinuityValidationReport {
  status: 'PASS' | 'WARN' | 'FAIL';
  severity: ConflictSeverity;
  conflicts: ContinuityConflict[];
  checkedAt: Date;
  chapterId?: string;
  sceneId?: string;
}

// ====================================================================
// Continuity Window (what LLM receives)
// ====================================================================

export interface ContinuityWindowConfig {
  windowChapters: number;
  maxEntities: number;
  maxTokenEstimate: number;
  participatingCharacters: string[];
  participatingLocations: string[];
  participatingFactions: string[];
  activeThreadIds: string[];
}

export interface ContinuityWindow {
  novelId: string;
  forChapter: number;
  currentState: Partial<StoryState>;
  recentMemories: ChapterMemory[];
  activeThreads: PlotThreadState[];
  relevantCharacterKnowledge: KnowledgeState[];
  worldFacts: WorldFact[];
  sceneConstraints?: string[];
  config: ContinuityWindowConfig;
  tokenEstimate: number;
}

// ====================================================================
// Generation Quality Gate types
// ====================================================================

export enum QualityGateResult {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
}

export interface QualityGateReport {
  result: QualityGateResult;
  structuralValidation: QualityGateResult;
  continuityValidation: QualityGateResult;
  knowledgeValidation: QualityGateResult;
  stateTransitionValidation: QualityGateResult;
  plotThreadValidation: QualityGateResult;
  characterArcValidation: QualityGateResult;
  budgetValidation: QualityGateResult;
  conflicts: ContinuityConflict[];
  warnings: string[];
  recommendation: 'PROMOTE' | 'REVISE' | 'BLOCK';
}
