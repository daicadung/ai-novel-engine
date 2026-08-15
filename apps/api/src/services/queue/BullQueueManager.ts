import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobType, JobPayload, JobOptions, JobStatus, QueueName } from '@ane/core';
import { IQueueManager, EnqueuedJob } from './types.js';

export class BullQueueManager implements IQueueManager {
  private queue: Queue;
  private connection: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null
    });
    this.queue = new Queue(QueueName.GENERATION_QUEUE, { connection: this.connection });
  }

  async addJob(type: JobType, payload: JobPayload, options?: JobOptions): Promise<EnqueuedJob> {
    const job = await this.queue.add(type, payload, {
      jobId: options?.jobId,
      attempts: options?.attempts || 3,
      backoff: options?.backoff || { type: 'exponential', delay: 1000 },
      removeOnComplete: options?.removeOnComplete ?? false,
      removeOnFail: options?.removeOnFail ?? false,
      parent: options?.parent
    });

    return {
      id: job.id!,
      type,
      payload,
      status: JobStatus.QUEUED,
      progress: 0
    };
  }

  async getJob(jobId: string): Promise<EnqueuedJob | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    
    // We need to resolve status asynchronously for BullMQ
    const state = await job.getState();
    let status = JobStatus.QUEUED;
    if (state === 'failed') status = JobStatus.FAILED;
    else if (state === 'completed') status = JobStatus.COMPLETED;
    else if (state === 'active') status = JobStatus.RUNNING;
    else if (state === 'delayed' || state === 'waiting' || state === 'prioritized') status = JobStatus.QUEUED;

    return {
      id: job.id!,
      type: job.name as JobType,
      payload: job.data as JobPayload,
      status,
      progress: typeof job.progress === 'number' ? job.progress : 0
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.getJob(jobId);
    return job ? job.status : null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    
    // BullMQ allows removing delayed/waiting jobs. Active jobs need careful handling.
    const state = await job.getState();
    if (state === 'active') {
      // In a real app we might set a cancellation flag or use soft kill
      // For this abstraction, we just attempt to remove it
      await job.remove();
      return true;
    } else {
      await job.remove();
      return true;
    }
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
