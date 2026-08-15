import { JobDispatcher } from './JobDispatcher.js';
import { QueueFactory } from './index.js';
import { JobStatus } from '@ane/core';
export class MemoryWorker {
    dispatcher;
    queueManager;
    isProcessing = false;
    intervalId = null;
    constructor() {
        this.dispatcher = new JobDispatcher();
        this.queueManager = QueueFactory.getQueueManager();
    }
    async start() {
        if (this.intervalId)
            return;
        this.intervalId = setInterval(() => this.processNext(), 100);
    }
    async processNext() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            const jobs = this.queueManager.getJobs();
            const nextJob = jobs.find(j => j.status === JobStatus.QUEUED);
            if (nextJob) {
                this.queueManager.updateJobStatus(nextJob.id, JobStatus.RUNNING);
                try {
                    await this.dispatcher.dispatch(nextJob.type, nextJob.payload);
                    this.queueManager.updateJobStatus(nextJob.id, JobStatus.COMPLETED);
                }
                catch (e) {
                    console.error(`Job ${nextJob.id} failed:`, e);
                    this.queueManager.updateJobStatus(nextJob.id, JobStatus.FAILED);
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    async pause() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    async resume() {
        await this.start();
    }
    async close() {
        await this.pause();
    }
    // Synchronous run for tests to drain the queue without polling
    async drainQueue() {
        while (true) {
            const jobs = this.queueManager.getJobs();
            const nextJob = jobs.find(j => j.status === JobStatus.QUEUED);
            if (!nextJob)
                break;
            this.queueManager.updateJobStatus(nextJob.id, JobStatus.RUNNING);
            try {
                await this.dispatcher.dispatch(nextJob.type, nextJob.payload);
                this.queueManager.updateJobStatus(nextJob.id, JobStatus.COMPLETED);
            }
            catch (e) {
                this.queueManager.updateJobStatus(nextJob.id, JobStatus.FAILED);
            }
        }
    }
}
