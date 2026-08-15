export declare enum JobType {
    ARCHITECT_STAGE = "ARCHITECT_STAGE",
    PLANNER_STAGE = "PLANNER_STAGE",
    SCENE_GENERATION = "SCENE_GENERATION",
    PROSE_GENERATION = "PROSE_GENERATION",
    PROSE_REVISION = "PROSE_REVISION",
    QUALITY_REPAIR = "QUALITY_REPAIR",
    STORY_PLANNING = "STORY_PLANNING"
}
export declare enum QueueName {
    GENERATION_QUEUE = "generation_queue"
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
    parentId?: string;
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
    strategy: string;
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
export type JobPayload = ArchitectJobPayload | PlannerJobPayload | SceneJobPayload | ProseJobPayload | QualityRepairJobPayload | StoryPlanningJobPayload;
export interface JobOptions {
    jobId?: string;
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
export declare enum JobStatus {
    QUEUED = "QUEUED",
    CLAIMED = "CLAIMED",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    PAUSED = "PAUSED",
    CANCELLED = "CANCELLED",
    RETRY_PENDING = "RETRY_PENDING",
    BLOCKED = "BLOCKED"
}
