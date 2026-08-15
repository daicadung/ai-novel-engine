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

  // =====================================================================
  // Phase 9: GET /novels/:novelId/generation/continuity
  // Current canonical story state
  // =====================================================================
  app.get('/novels/:novelId/generation/continuity', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const storyState = await db.storyStateRecord.findFirst({
      where: { novelId, isCanonical: true },
      orderBy: { asOfChapter: 'desc' },
    });

    const latestSnapshot = await db.continuitySnapshot.findFirst({
      where: { novelId, status: 'CANONICAL' },
      orderBy: { chapterNumber: 'desc' },
    });

    return reply.send({
      success: true,
      data: {
        storyState: storyState?.state ?? null,
        asOfChapter: storyState?.asOfChapter ?? 0,
        latestSnapshotChapter: latestSnapshot?.chapterNumber ?? 0,
        continuityEnabled: novel.continuityEnabled,
        lastCanonicalChapter: novel.lastCanonicalChapter,
      },
    });
  });

  // =====================================================================
  // Phase 9: GET /novels/:novelId/generation/threads
  // Active plot threads
  // =====================================================================
  app.get('/novels/:novelId/generation/threads', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const threads = await db.plotThread.findMany({
      where: { novelId },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    });

    return reply.send({ success: true, data: threads });
  });

  // =====================================================================
  // Phase 9: GET /novels/:novelId/generation/characters
  // Character state from canonical story state
  // =====================================================================
  app.get('/novels/:novelId/generation/characters', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const storyState = await db.storyStateRecord.findFirst({
      where: { novelId, isCanonical: true },
      orderBy: { asOfChapter: 'desc' },
    });

    const characters = (storyState?.state as any)?.characters ?? {};

    return reply.send({
      success: true,
      data: {
        characters,
        asOfChapter: storyState?.asOfChapter ?? 0,
      },
    });
  });

  // =====================================================================
  // Phase 9: GET /novels/:novelId/generation/memory
  // Chapter memory records
  // =====================================================================
  app.get('/novels/:novelId/generation/memory', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const memories = await db.chapterMemoryRecord.findMany({
      where: { novelId },
      orderBy: { chapterNumber: 'desc' },
      take: 20,
      select: {
        chapterId: true,
        chapterNumber: true,
        summary: true,
        keyEvents: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: memories });
  });

  // =====================================================================
  // Phase 9: GET /novels/:novelId/generation/conflicts
  // Latest quality gate conflicts
  // =====================================================================
  app.get('/novels/:novelId/generation/conflicts', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const gates = await db.proseQualityGate.findMany({
      where: { novelId, result: { not: 'PASS' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return reply.send({
      success: true,
      data: gates.map((g) => ({
        chapterId: g.chapterId,
        result: g.result,
        report: g.report,
        createdAt: g.createdAt,
      })),
    });
  });

  // =====================================================================
  // Phase 9: POST /novels/:novelId/generation/revalidate
  // Re-run quality gate on the latest canonical prose version
  // =====================================================================
  app.post('/novels/:novelId/generation/revalidate', {
    schema: { params: novelParams, body: z.object({ chapterId: z.string() }) },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { chapterId } = req.body;

    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const chapterProse = await db.chapterProse.findUnique({
      where: { chapterId },
      include: {
        versions: { where: { status: 'CANONICAL' }, take: 1 },
      },
    });

    if (!chapterProse?.versions?.[0]) {
      return reply.status(404).send({ success: false, error: 'No canonical prose version found' });
    }

    const { GenerationQualityGate } = await import('../services/continuity/GenerationQualityGate.js');
    const report = await GenerationQualityGate.runGate(
      novelId,
      chapterId,
      chapterProse.versions[0].id
    );

    return reply.send({ success: true, data: report });
  });

  // =====================================================================
  // Phase 9: POST /novels/:novelId/generation/retry-blocked
  // Re-queue BLOCKED jobs
  // =====================================================================
  app.post('/novels/:novelId/generation/retry-blocked', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const result = await db.generationJob.updateMany({
      where: { novelId, status: 'BLOCKED' },
      data: { status: 'QUEUED', retryCount: 0, scheduledAt: new Date() },
    });

    return reply.send({ success: true, data: { requeued: result.count } });
  });
};

