import { z } from 'zod';

// ====================================================================
// Novel Generation State Machine
// ====================================================================

export enum NovelGenerationState {
  DRAFT = 'DRAFT',
  INITIALIZING = 'INITIALIZING',
  ARCHITECTING = 'ARCHITECTING',
  PLANNING = 'PLANNING',
  GENERATING_CHAPTERS = 'GENERATING_CHAPTERS',
  GENERATING_SCENES = 'GENERATING_SCENES',
  GENERATING_PROSE = 'GENERATING_PROSE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
}

// ====================================================================
// Generation Stage Types (for resolver output)
// ====================================================================

export enum GenerationStageType {
  ARCHITECT = 'ARCHITECT',
  PLANNER_DESTINATION = 'PLANNER_DESTINATION',
  PLANNER_MACRO = 'PLANNER_MACRO',
  PLANNER_SAGA = 'PLANNER_SAGA',
  PLANNER_ARC = 'PLANNER_ARC',
  PLANNER_MINI_ARC = 'PLANNER_MINI_ARC',
  CHAPTER_BLUEPRINT = 'CHAPTER_BLUEPRINT',
  SCENE_PLAN = 'SCENE_PLAN',
  PROSE = 'PROSE',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

// ====================================================================
// Novel Generation Configuration (Zod-validated)
// ====================================================================

export const NovelGenerationConfigSchema = z.object({
  autoContinue: z.boolean().default(false),
  autoGenerateScenes: z.boolean().default(true),
  autoGenerateProse: z.boolean().default(true),
  maxConcurrentJobs: z.number().int().min(1).max(20).default(3),
  chapterBatchSize: z.number().int().min(1).max(100).default(10),
  generationWindowSize: z.number().int().min(1).max(20).default(2),
  maxGenerationCostUsd: z.number().positive().optional(),
  targetChapterCount: z.number().int().positive().max(10000).optional(),
});

export type NovelGenerationConfig = z.infer<typeof NovelGenerationConfigSchema>;

// ====================================================================
// Stage Resolution Result
// ====================================================================

export interface GenerationStageResult {
  stage: GenerationStageType;
  ready: boolean;
  reason: string;
  blockers: string[];
  /** Contextual metadata for the orchestrator to create the right job */
  context?: {
    chapterStart?: number;
    chapterEnd?: number;
    chapterId?: string;
    sagaId?: string;
    arcId?: string;
    miniArcId?: string;
    parentId?: string;
  };
}

// ====================================================================
// Generation Status (returned by GET /generation/status)
// ====================================================================

export interface GenerationBudgetInfo {
  maxGenerationCostUsd?: number;
  estimatedTotalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  remainingBudgetUsd?: number;
}

export interface GenerationStatus {
  novelId: string;
  state: NovelGenerationState;
  autoContinue: boolean;
  targetChapters: number | null;
  completedChapters: number;
  currentChapter: number | null;
  progressPercent: number;
  activeJobs: number;
  queuedJobs: number;
  failedJobs: number;
  retryPendingJobs: number;
  currentStage: GenerationStageType | null;
  budget: GenerationBudgetInfo;
  correlationId: string | null;
  blockers: string[];
}

// ====================================================================
// Generation Progress (returned by GET /generation/progress)
// ====================================================================

export interface ChapterWindow {
  start: number;
  end: number;
}

export interface GenerationProgress {
  targetChapters: number | null;
  completedChapters: number;
  plannedChapters: number;
  scenePlannedChapters: number;
  proseCompletedChapters: number;
  currentWindow: ChapterWindow | null;
  percent: number;
}
