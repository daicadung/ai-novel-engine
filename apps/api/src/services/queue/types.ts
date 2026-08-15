import { JobType, JobPayload, JobOptions, JobStatus } from '@ane/core';

export interface EnqueuedJob {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: JobStatus;
  progress?: number;
}

export interface IQueueManager {
  addJob(type: JobType, payload: JobPayload, options?: JobOptions): Promise<EnqueuedJob>;
  getJob(jobId: string): Promise<EnqueuedJob | null>;
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  cancelJob(jobId: string): Promise<boolean>;
  pauseQueue(): Promise<void>;
  resumeQueue(): Promise<void>;
}

export interface IWorker {
  start(): Promise<void>;
  close(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}
