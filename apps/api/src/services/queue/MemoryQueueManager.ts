import { JobType, JobPayload, JobOptions, JobStatus } from '@ane/core';
import { IQueueManager, EnqueuedJob } from './types.js';
import { randomUUID } from 'crypto';

export class MemoryQueueManager implements IQueueManager {
  private jobs: Map<string, EnqueuedJob> = new Map();
  private paused: boolean = false;

  async addJob(type: JobType, payload: JobPayload, options?: JobOptions): Promise<EnqueuedJob> {
    const id = options?.jobId || randomUUID();
    const job: EnqueuedJob = {
      id,
      type,
      payload,
      status: this.paused ? JobStatus.PAUSED : JobStatus.QUEUED,
      progress: 0
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(jobId: string): Promise<EnqueuedJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    return job ? job.status : null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.status = JobStatus.CANCELLED;
    return true;
  }

  async pauseQueue(): Promise<void> {
    this.paused = true;
  }

  async resumeQueue(): Promise<void> {
    this.paused = false;
  }

  // Test helpers
  updateJobStatus(jobId: string, status: JobStatus) {
    const job = this.jobs.get(jobId);
    if (job) job.status = status;
  }

  getJobs() {
    return Array.from(this.jobs.values());
  }

  clear() {
    this.jobs.clear();
  }
}
