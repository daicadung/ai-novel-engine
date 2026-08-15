import { z } from 'zod';
import { ArchitectStage } from '@ane/core';
import { db } from '@ane/database';
import { ArchitectManager } from '../services/architect/manager.js';
import { NotFoundError } from '../errors/index.js';
export const architectRoutes = async (app) => {
    const manager = new ArchitectManager();
    app.post('/novels/:novelId/architect/start', {
        schema: {
            params: z.object({ novelId: z.string() })
        }
    }, async (req, reply) => {
        const { novelId } = req.params;
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new NotFoundError('Novel not found');
        // Run the first stage in background without waiting
        manager.runStage(novelId, ArchitectStage.CONCEPT).catch(e => {
            app.log.error(`Architect run failed for novel ${novelId}: ${e.message}`);
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
        // Background run
        manager.runStage(novelId, stage).catch(e => {
            app.log.error(`Architect stage run failed: ${e.message}`);
        });
        return { success: true, stage, status: "RUNNING" };
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
        // Background run with retry flag
        manager.runStage(novelId, stage, true).catch(e => {
            app.log.error(`Architect stage retry failed: ${e.message}`);
        });
        return { success: true, stage, status: "RUNNING (RETRY)" };
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
