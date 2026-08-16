export type GenerationJobStatus = 'pending' | 'running' | 'paused' | 'retrying' | 'completed' | 'failed' | 'canceled';
export type GenerationStepStatus = 'pending' | 'started' | 'completed' | 'failed' | 'skipped';

export type PipelineStepName = 
  | 'concept_generation' 
  | 'concept_selection' 
  | 'story_dna' 
  | 'story_bible' 
  | 'longform_plan' 
  | 'chapter_outline' 
  | 'chapter_write' 
  | 'memory_extract' 
  | 'continuity_check' 
  | 'repair_prompt' 
  | 'complete';

export interface GenerationStep {
  name: PipelineStepName;
  status: GenerationStepStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface GenerationCheckpoint {
  step_name: PipelineStepName;
  payload: Record<string, unknown>;
  saved_at: string;
}

export interface GenerationFailure {
  step_name: PipelineStepName;
  error_message: string;
  failed_at: string;
  recoverable: boolean;
}

export interface GenerationJob {
  id: string;
  novel_id: string;
  status: GenerationJobStatus;
  steps: GenerationStep[];
  checkpoints: GenerationCheckpoint[];
  failures: GenerationFailure[];
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface QueueAdapter {
  enqueue(jobId: string): Promise<void>;
  dequeue(): Promise<string | null>;
  peek(): Promise<string | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}
