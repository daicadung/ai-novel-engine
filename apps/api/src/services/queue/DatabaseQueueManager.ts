import { JobType, JobPayload, JobOptions, JobStatus } from '@ane/core';
import { IQueueManager, EnqueuedJob } from './types.js';
import { db } from '@ane/database';

export class DatabaseQueueManager implements IQueueManager {
  
  async addJob(type: JobType, payload: JobPayload, options?: JobOptions): Promise<EnqueuedJob> {
    const status = JobStatus.QUEUED as any; // Map to GenerationJobStatus.QUEUED

    // Try to find if job already exists for idempotency
    if (options?.jobId) {
      const existing = await db.generationJob.findUnique({
        where: { id: options.jobId }
      });
      if (existing) {
        return {
          id: existing.id,
          type: type,
          payload: existing.input as unknown as JobPayload,
          status: existing.status as unknown as JobStatus,
        };
      }
    }

    const job = await db.generationJob.create({
      data: {
        id: options?.jobId,
        novelId: payload.novelId,
        status: status,
        input: payload as any,
        retryCount: 0,
        maxRetries: options?.attempts ?? 3,
        parentJobId: options?.parent?.id,
        correlationId: options?.jobId,
        // Calculate stage fields if applicable based on JobType
        ...(type === JobType.ARCHITECT_STAGE && { stage: (payload as any).stage }),
        ...(type === JobType.PLANNER_STAGE && { plannerStage: (payload as any).stage }),
        // ... map other types if needed, but payload has all the details anyway
      }
    });

    return {
      id: job.id,
      type,
      payload,
      status: job.status as unknown as JobStatus
    };
  }

  async getJob(jobId: string): Promise<EnqueuedJob | null> {
    const job = await db.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    // We don't store the exact JobType string in the DB directly, 
    // but we can infer it from the stages if we really need to, 
    // or we can store it in 'payload.jobType'. 
    // For now we just return it as unknown or derived from payload
    const payload = job.input as any;
    let type = JobType.PROSE_GENERATION; // default/fallback
    if (job.stage) type = JobType.ARCHITECT_STAGE;
    else if (job.plannerStage) type = JobType.PLANNER_STAGE;
    else if (job.sceneStage) type = JobType.SCENE_GENERATION;
    else if (job.proseStage) type = JobType.PROSE_GENERATION;
    else if (payload && payload.stage) {
      if (Object.values(JobType).includes(payload.type)) {
        type = payload.type;
      }
    }

    return {
      id: job.id,
      type,
      payload: job.input as unknown as JobPayload,
      status: job.status as unknown as JobStatus
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await db.generationJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job) return null;
    return job.status as unknown as JobStatus;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await db.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return false;
    
    if (job.status === 'RUNNING' || job.status === 'CLAIMED') {
      // It's actively running, we can only update the status and hope the worker respects it
      await db.generationJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
      });
      return true;
    }

    await db.generationJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' }
    });
    return true;
  }

  async pauseQueue(): Promise<void> {
    // We don't have a global pause in the database trivially unless we add a flag.
    // For now, this is a no-op or we can throw an unsupported error.
    console.warn("pauseQueue is not natively supported by DatabaseQueueManager");
  }

  async resumeQueue(): Promise<void> {
    console.warn("resumeQueue is not natively supported by DatabaseQueueManager");
  }
}
