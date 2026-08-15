import { z } from 'zod';
import { ArchitectStage, JobType } from '@ane/core';
import { db } from '@ane/database';
import { QueueFactory } from '../services/queue/index.js';
import { NotFoundError } from '../errors/index.js';
export const architectRoutes = async (app) => {
    const queueManager = QueueFactory.getQueueManager();
    app.post('/novels/:novelId/architect/start', {
        schema: {
            params: z.object({ novelId: z.string() })
        }
    }, async (req, reply) => {
        const { novelId } = req.params;
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new NotFoundError('Novel not found');
        // Run the first stage via queue
        await queueManager.addJob(JobType.ARCHITECT_STAGE, {
            novelId,
            stage: ArchitectStage.CONCEPT
        });
        return { success: true, message: "Architect started", stage: ArchitectStage.CONCEPT };
    });
    app.get('/novels/:novelId/architect/status', {
        schema: {
            params: z.object({ novelId: z.string() })
        }
    }, async (req, reply) => {
        const { novelId } = req.params;
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new NotFoundError('Novel not found');
        return {
            architectStage: novel.architectStage,
            architectStatus: novel.architectStatus
        };
    });
    app.post('/novels/:novelId/architect/stages/:stage/run', {
        schema: {
            params: z.object({
                novelId: z.string(),
                stage: z.nativeEnum(ArchitectStage)
            })
        }
    }, async (req, reply) => {
        const { novelId, stage } = req.params;
        // Background run via queue
        await queueManager.addJob(JobType.ARCHITECT_STAGE, { novelId, stage });
        return { success: true, stage, status: "QUEUED" };
    });
    app.post('/novels/:novelId/architect/stages/:stage/retry', {
        schema: {
            params: z.object({
                novelId: z.string(),
                stage: z.nativeEnum(ArchitectStage)
            })
        }
    }, async (req, reply) => {
        const { novelId, stage } = req.params;
        // Background run via queue
        await queueManager.addJob(JobType.ARCHITECT_STAGE, { novelId, stage, isRetry: true });
        return { success: true, stage, status: "QUEUED" };
    });
    app.get('/novels/:novelId/architect/jobs', {
        schema: {
            params: z.object({ novelId: z.string() })
        }
    }, async (req, reply) => {
        const jobs = await db.generationJob.findMany({
            where: { novelId: req.params.novelId },
            orderBy: { createdAt: 'desc' }
        });
        return jobs;
    });
    app.get('/novels/:novelId/architect/result/:stage', {
        schema: {
            params: z.object({
                novelId: z.string(),
                stage: z.nativeEnum(ArchitectStage)
            })
        }
    }, async (req, reply) => {
        const { novelId, stage } = req.params;
        const job = await db.generationJob.findFirst({
            where: { novelId, stage, status: 'SUCCEEDED' },
            orderBy: { createdAt: 'desc' }
        });
        if (!job)
            throw new NotFoundError(`No successful result found for stage ${stage}`);
        return job.output;
    });
};
