import { GenerationJob, PipelineStepName, GenerationCheckpoint } from '../types';

export type Clock = () => Date;
export type IdFactory = () => string;

const DEFAULT_PIPELINE: PipelineStepName[] = [
  'concept_generation',
  'concept_selection',
  'story_dna',
  'story_bible',
  'longform_plan',
  'chapter_outline',
  'chapter_write',
  'memory_extract',
  'continuity_check',
  'repair_prompt',
  'complete'
];

export function createJob(novelId: string, idFactory: IdFactory, clock: Clock): GenerationJob {
  const now = clock().toISOString();
  return {
    id: idFactory(),
    novel_id: novelId,
    status: 'pending',
    steps: DEFAULT_PIPELINE.map(name => ({ name, status: 'pending' })),
    checkpoints: [],
    failures: [],
    retry_count: 0,
    max_retries: 3,
    created_at: now,
    updated_at: now
  };
}

export function startJob(job: GenerationJob, clock: Clock): GenerationJob {
  if (job.status !== 'pending' && job.status !== 'paused' && job.status !== 'retrying') {
    return job; // invalid transition, ignore or could throw
  }
  return {
    ...job,
    status: 'running',
    updated_at: clock().toISOString()
  };
}

export function pauseJob(job: GenerationJob, clock: Clock): GenerationJob {
  if (job.status !== 'running' && job.status !== 'retrying') {
    return job;
  }
  return {
    ...job,
    status: 'paused',
    updated_at: clock().toISOString()
  };
}

export function resumeJob(job: GenerationJob, clock: Clock): GenerationJob {
  if (job.status !== 'paused') {
    return job;
  }
  return {
    ...job,
    status: 'running',
    updated_at: clock().toISOString()
  };
}

export function cancelJob(job: GenerationJob, clock: Clock): GenerationJob {
  return {
    ...job,
    status: 'canceled',
    updated_at: clock().toISOString()
  };
}

export function markStepStarted(job: GenerationJob, stepName: PipelineStepName, clock: Clock): GenerationJob {
  const now = clock().toISOString();
  const steps = job.steps.map(s => 
    s.name === stepName ? { ...s, status: 'started' as const, started_at: now } : s
  );
  return { ...job, steps, updated_at: now };
}

export function markStepCompleted(job: GenerationJob, stepName: PipelineStepName, payload: Record<string, unknown>, clock: Clock): GenerationJob {
  const now = clock().toISOString();
  const steps = job.steps.map(s => 
    s.name === stepName ? { ...s, status: 'completed' as const, completed_at: now } : s
  );
  const checkpoint: GenerationCheckpoint = { step_name: stepName, payload, saved_at: now };
  
  // if this is 'complete', mark job completed
  const status = stepName === 'complete' ? 'completed' : job.status;

  return { 
    ...job, 
    steps, 
    status,
    checkpoints: [...job.checkpoints, checkpoint], 
    updated_at: now 
  };
}

export function markStepFailed(job: GenerationJob, stepName: PipelineStepName, error: string, recoverable: boolean, clock: Clock): GenerationJob {
  const now = clock().toISOString();
  const steps = job.steps.map(s => 
    s.name === stepName ? { ...s, status: 'failed' as const, error } : s
  );
  return {
    ...job,
    steps,
    status: 'failed',
    last_error: error,
    failures: [...job.failures, { step_name: stepName, error_message: error, failed_at: now, recoverable }],
    updated_at: now
  };
}

export function scheduleRetry(job: GenerationJob, delayMs: number, clock: Clock): GenerationJob {
  if (job.retry_count >= job.max_retries) {
    return job; // Cannot retry
  }
  const now = clock();
  const nextRetryAt = new Date(now.getTime() + delayMs).toISOString();
  
  return {
    ...job,
    status: 'retrying',
    retry_count: job.retry_count + 1,
    next_retry_at: nextRetryAt,
    updated_at: now.toISOString()
  };
}

export function getNextRunnableStep(job: GenerationJob): PipelineStepName | null {
  if (job.status === 'canceled' || job.status === 'completed') {
    return null;
  }
  const next = job.steps.find(s => s.status === 'pending' || s.status === 'failed');
  return next ? next.name : null;
}

export function resumeFromCheckpoint(job: GenerationJob, checkpoint: GenerationCheckpoint, clock: Clock): GenerationJob {
  // Mark all steps up to and including the checkpoint as completed
  const stepIndex = job.steps.findIndex(s => s.name === checkpoint.step_name);
  if (stepIndex === -1) return job;

  const now = clock().toISOString();
  const steps = job.steps.map((s, idx) => {
    if (idx <= stepIndex) {
      return { ...s, status: 'completed' as const, completed_at: s.completed_at || now };
    }
    return s;
  });

  return {
    ...job,
    steps,
    checkpoints: [...job.checkpoints, checkpoint], // Assuming we just add it to history
    status: 'paused', // Start in paused state, must be explicitly resumed
    updated_at: now
  };
}
