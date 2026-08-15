import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { JobStatus, QueueName } from '@ane/core';
export class BullQueueManager {
    queue;
    connection;
    constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
        this.connection = new Redis(redisUrl, {
            maxRetriesPerRequest: null
        });
        this.queue = new Queue(QueueName.GENERATION_QUEUE, { connection: this.connection });
    }
    async addJob(type, payload, options) {
        const job = await this.queue.add(type, payload, {
            jobId: options?.jobId,
            attempts: options?.attempts || 3,
            backoff: options?.backoff || { type: 'exponential', delay: 1000 },
            removeOnComplete: options?.removeOnComplete ?? false,
            removeOnFail: options?.removeOnFail ?? false,
            parent: options?.parent
        });
        return {
            id: job.id,
            type,
            payload,
            status: JobStatus.QUEUED,
            progress: 0
        };
    }
    async getJob(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job)
            return null;
        // We need to resolve status asynchronously for BullMQ
        const state = await job.getState();
        let status = JobStatus.QUEUED;
        if (state === 'failed')
            status = JobStatus.FAILED;
        else if (state === 'completed')
            status = JobStatus.COMPLETED;
        else if (state === 'active')
            status = JobStatus.RUNNING;
        else if (state === 'delayed' || state === 'waiting' || state === 'prioritized')
            status = JobStatus.QUEUED;
        return {
            id: job.id,
            type: job.name,
            payload: job.data,
            status,
            progress: typeof job.progress === 'number' ? job.progress : 0
        };
    }
    async getJobStatus(jobId) {
        const job = await this.getJob(jobId);
        return job ? job.status : null;
    }
    async cancelJob(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job)
            return false;
        // BullMQ allows removing delayed/waiting jobs. Active jobs need careful handling.
        const state = await job.getState();
        if (state === 'active') {
            // In a real app we might set a cancellation flag or use soft kill
            // For this abstraction, we just attempt to remove it
            await job.remove();
            return true;
        }
        else {
            await job.remove();
            return true;
        }
    }
    async pauseQueue() {
        await this.queue.pause();
    }
    async resumeQueue() {
        await this.queue.resume();
    }
    async close() {
        await this.queue.close();
        this.connection.disconnect();
    }
}
