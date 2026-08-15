import { IWorker, EnqueuedJob } from './types.js';
import { MemoryQueueManager } from './MemoryQueueManager.js';
import { JobDispatcher } from './JobDispatcher.js';
import { QueueFactory } from './index.js';
import { JobStatus } from '@ane/core';

export class MemoryWorker implements IWorker {
  private dispatcher: JobDispatcher;
  private queueManager: MemoryQueueManager;
  private isProcessing: boolean = false;
  private intervalId: any = null;

  constructor() {
    this.dispatcher = new JobDispatcher();
    this.queueManager = QueueFactory.getQueueManager() as MemoryQueueManager;
  }

  async start(): Promise<void> {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processNext(), 100);
  }

  private async processNext() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const jobs = this.queueManager.getJobs();
      const nextJob = jobs.find(j => j.status === JobStatus.QUEUED);
      if (nextJob) {
        this.queueManager.updateJobStatus(nextJob.id, JobStatus.RUNNING);
        try {
          await this.dispatcher.dispatch(nextJob.type, nextJob.payload);
          this.queueManager.updateJobStatus(nextJob.id, JobStatus.COMPLETED);
        } catch (e: any) {
          console.error(`Job ${nextJob.id} failed:`, e);
          this.queueManager.updateJobStatus(nextJob.id, JobStatus.FAILED);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async pause(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async resume(): Promise<void> {
    await this.start();
  }

  async close(): Promise<void> {
    await this.pause();
  }

  // Synchronous run for tests to drain the queue without polling
  async drainQueue(): Promise<void> {
    while (true) {
      const jobs = this.queueManager.getJobs();
      const nextJob = jobs.find(j => j.status === JobStatus.QUEUED);
      if (!nextJob) break;
      
      this.queueManager.updateJobStatus(nextJob.id, JobStatus.RUNNING);
      try {
        await this.dispatcher.dispatch(nextJob.type, nextJob.payload);
        this.queueManager.updateJobStatus(nextJob.id, JobStatus.COMPLETED);
      } catch (e: any) {
        this.queueManager.updateJobStatus(nextJob.id, JobStatus.FAILED);
      }
    }
  }
}
