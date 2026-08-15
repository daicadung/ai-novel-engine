import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueName } from '@ane/core';
import { JobDispatcher } from './JobDispatcher.js';
export class BullWorker {
    worker;
    dispatcher;
    connection;
    constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
        this.connection = new Redis(redisUrl, {
            maxRetriesPerRequest: null
        });
        this.dispatcher = new JobDispatcher();
        // Concurrency limit: defaults to 5. Could be configured via env var.
        const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
        this.worker = new Worker(QueueName.GENERATION_QUEUE, async (job) => {
            // Execute the job through the dispatcher
            return await this.dispatcher.dispatch(job.name, job.data);
        }, {
            connection: this.connection,
            concurrency
        });
        this.worker.on('failed', (job, err) => {
            console.error(`Job ${job?.id} failed with error:`, err.message);
        });
    }
    async start() {
        // BullMQ worker starts processing immediately by default
    }
    async pause() {
        await this.worker.pause();
    }
    async resume() {
        await this.worker.resume();
    }
    async close() {
        await this.worker.close();
        this.connection.disconnect();
    }
}
