import { JobStatus } from '@ane/core';
import { randomUUID } from 'crypto';
export class MemoryQueueManager {
    jobs = new Map();
    paused = false;
    async addJob(type, payload, options) {
        const id = options?.jobId || randomUUID();
        const job = {
            id,
            type,
            payload,
            status: this.paused ? JobStatus.PAUSED : JobStatus.QUEUED,
            progress: 0
        };
        this.jobs.set(id, job);
        return job;
    }
    async getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }
    async getJobStatus(jobId) {
        const job = this.jobs.get(jobId);
        return job ? job.status : null;
    }
    async cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return false;
        job.status = JobStatus.CANCELLED;
        return true;
    }
    async pauseQueue() {
        this.paused = true;
    }
    async resumeQueue() {
        this.paused = false;
    }
    // Test helpers
    updateJobStatus(jobId, status) {
        const job = this.jobs.get(jobId);
        if (job)
            job.status = status;
    }
    getJobs() {
        return Array.from(this.jobs.values());
    }
    clear() {
        this.jobs.clear();
    }
}
