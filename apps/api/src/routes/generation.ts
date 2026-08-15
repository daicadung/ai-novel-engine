import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
import { NovelGenerationOrchestrator } from '../services/generation/NovelGenerationOrchestrator.js';
import { NovelGenerationConfigSchema } from '@ane/core';

const orchestrator = new NovelGenerationOrchestrator();

export const generationRoutes: FastifyPluginAsyncZod = async (app) => {
  const novelParams = z.object({ novelId: z.string().uuid() });

  // =====================================================================
  // POST /novels/:novelId/generation/start
  // Start autonomous generation (idempotent)
  // =====================================================================
  app.post('/novels/:novelId/generation/start', {
    schema: {
      params: novelParams,
      body: NovelGenerationConfigSchema.partial().optional(),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const config = req.body ?? {};
    const status = await orchestrator.start(novelId, config);

    return reply.status(202).send({ success: true, data: status });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/pause
  // =====================================================================
  app.post('/novels/:novelId/generation/pause', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    await orchestrator.pause(novelId);
    return reply.send({ success: true, data: { state: 'PAUSED' } });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/resume
  // =====================================================================
  app.post('/novels/:novelId/generation/resume', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    await orchestrator.resume(novelId);
    const status = await orchestrator.getStatus(novelId);
    return reply.send({ success: true, data: status });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/cancel
  // Cancel queued jobs (non-destructive)
  // =====================================================================
  app.post('/novels/:novelId/generation/cancel', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const result = await orchestrator.cancel(novelId);
    return reply.send({ success: true, data: result });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/status
  // =====================================================================
  app.get('/novels/:novelId/generation/status', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const status = await orchestrator.getStatus(novelId);
    return reply.send({ success: true, data: status });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/progress
  // =====================================================================
  app.get('/novels/:novelId/generation/progress', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const progress = await orchestrator.getProgress(novelId);
    return reply.send({ success: true, data: progress });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/advance
  // Manually trigger one orchestration evaluation step
  // =====================================================================
  app.post('/novels/:novelId/generation/advance', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    await orchestrator.advance(novelId);
    const status = await orchestrator.getStatus(novelId);
    return reply.status(202).send({ success: true, data: status });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/retry-failed
  // =====================================================================
  app.post('/novels/:novelId/generation/retry-failed', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const result = await orchestrator.retryFailed(novelId);
    return reply.send({ success: true, data: result });
  });
};
