import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { QueueName } from '@ane/core';
import { IWorker } from './types.js';
import { JobDispatcher } from './JobDispatcher.js';

export class BullWorker implements IWorker {
  private worker: Worker;
  private dispatcher: JobDispatcher;
  private connection: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null
    });
    this.dispatcher = new JobDispatcher();
    
    // Concurrency limit: defaults to 5. Could be configured via env var.
    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
    
    this.worker = new Worker(QueueName.GENERATION_QUEUE, async (job: Job) => {
      // Execute the job through the dispatcher
      return await this.dispatcher.dispatch(job.name as any, job.data);
    }, { 
      connection: this.connection,
      concurrency
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed with error:`, err.message);
    });
  }

  async start(): Promise<void> {
    // BullMQ worker starts processing immediately by default
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    await this.worker.resume();
  }

  async close(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
  }
}
