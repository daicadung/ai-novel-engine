import { GenerationJob } from '../types';

export interface GenerationJobPayload {
  id: string;
  novel_id: string;
  status: string;
  metadata: Record<string, any>;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export function mapJobToPersistence(job: GenerationJob): GenerationJobPayload {
  return {
    id: job.id,
    novel_id: job.novel_id,
    status: job.status,
    metadata: {
      steps: job.steps,
      checkpoints: job.checkpoints,
      failures: job.failures
    },
    retry_count: job.retry_count,
    max_retries: job.max_retries,
    next_retry_at: job.next_retry_at,
    last_error: job.last_error,
    created_at: job.created_at,
    updated_at: job.updated_at
  };
}
