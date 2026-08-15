export enum JobType {
  ARCHITECT_STAGE = 'ARCHITECT_STAGE',
  PLANNER_STAGE = 'PLANNER_STAGE',
  SCENE_GENERATION = 'SCENE_GENERATION',
  PROSE_GENERATION = 'PROSE_GENERATION',
  PROSE_REVISION = 'PROSE_REVISION',
  QUALITY_REPAIR = 'QUALITY_REPAIR',
  STORY_PLANNING = 'STORY_PLANNING',
  CAUSALITY_ANALYSIS = 'CAUSALITY_ANALYSIS',
}

export enum QueueName {
  GENERATION_QUEUE = 'generation_queue',
}

export interface BaseJobPayload {
  novelId: string;
}

export interface ArchitectJobPayload extends BaseJobPayload {
  stage: string;
  isRetry?: boolean;
}

export interface PlannerJobPayload extends BaseJobPayload {
  stage: string;
  parentId?: string; // For SAGA, ARC, MINI_ARC
  isRetry?: boolean;
}

export interface SceneJobPayload extends BaseJobPayload {
  chapterId: string;
  previousSnapshotId?: string;
  isRetry?: boolean;
}

export interface ProseJobPayload extends BaseJobPayload {
  chapterId: string;
  scenePlanVersionId: string;
  previousSnapshotId?: string;
  isRetry?: boolean;
}

export interface QualityRepairJobPayload extends BaseJobPayload {
  chapterId: string;
  chapterProseVersionId: string;
  repairPlanId: string;
  strategy: string;  // RepairStrategy
  issueIds: string[];
  attemptNumber: number;
  isRetry?: boolean;
}

export interface StoryPlanningJobPayload extends BaseJobPayload {
  /** Sub-operation: initial | arc_plan | chapter_objectives | replan | reconcile | milestone_recovery */
  operation: 'initial' | 'arc_plan' | 'chapter_objectives' | 'replan' | 'reconcile' | 'milestone_recovery';
  longHorizonPlanId?: string;
  arcPlanId?: string;
  chapterNumber?: number;
  chapterObjectiveId?: string;
  isRetry?: boolean;
}

export interface CausalityJobPayload extends BaseJobPayload {
  chapterId: string;
  chapterNumber: number;
  sourceStateVersion?: string;
  isRetry?: boolean;
}

export type JobPayload =
  | ArchitectJobPayload
  | PlannerJobPayload
  | SceneJobPayload
  | ProseJobPayload
  | QualityRepairJobPayload
  | StoryPlanningJobPayload
  | CausalityJobPayload;

export interface JobOptions {
  jobId?: string; // Idempotency key
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  parent?: {
    id: string;
    queue: string;
  };
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  RETRY_PENDING = 'RETRY_PENDING',
  BLOCKED = 'BLOCKED'
}
