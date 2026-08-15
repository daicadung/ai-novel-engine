import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
import { QualityOrchestrator } from '../services/quality/QualityOrchestrator.js';

const orchestrator = new QualityOrchestrator();

export const qualityRoutes: FastifyPluginAsyncZod = async (app) => {
  const novelParams = z.object({ novelId: z.string().uuid() });

  // =====================================================================
  // GET /novels/:novelId/generation/quality
  // Latest quality snapshot + health status
  // =====================================================================
  app.get('/novels/:novelId/generation/quality', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const latest = await db.qualitySnapshotRecord.findFirst({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        chapterId: true,
        chapterNumber: true,
        overallScore: true,
        healthStatus: true,
        issueCount: true,
        createdAt: true,
      },
    });

    const latestTrend = await db.qualityTrendRecord.findFirst({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      select: {
        direction: true,
        healthStatus: true,
        averageScore: true,
        consecutiveDrops: true,
        recoveryDetected: true,
        windowStart: true,
        windowEnd: true,
      },
    });

    return reply.send({
      success: true,
      data: {
        latestSnapshot: latest,
        trend: latestTrend,
      },
    });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/quality/issues
  // Unresolved quality issues
  // =====================================================================
  app.get('/novels/:novelId/generation/quality/issues', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const issues = await db.qualityIssueRecord.findMany({
      where: { novelId, resolved: false },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        chapterId: true,
        chapterNumber: true,
        issueType: true,
        severity: true,
        confidence: true,
        evidence: true,
        repairStrategy: true,
        isAutoRepairable: true,
        requiresLLM: true,
        detectedBy: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: issues });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/quality/trends
  // Quality trend history
  // =====================================================================
  app.get('/novels/:novelId/generation/quality/trends', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const trends = await db.qualityTrendRecord.findMany({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        windowStart: true,
        windowEnd: true,
        direction: true,
        healthStatus: true,
        averageScore: true,
        minScore: true,
        maxScore: true,
        consecutiveDrops: true,
        recoveryDetected: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: trends });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/quality/repairs
  // Repair history
  // =====================================================================
  app.get('/novels/:novelId/generation/quality/repairs', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const repairs = await db.repairAttemptRecord.findMany({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        chapterId: true,
        strategy: true,
        attemptNumber: true,
        outcome: true,
        originalScore: true,
        candidateScore: true,
        improvement: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: repairs });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/quality/analyze
  // Trigger on-demand quality analysis for a chapter
  // =====================================================================
  app.post('/novels/:novelId/generation/quality/analyze', {
    schema: {
      params: novelParams,
      body: z.object({
        chapterId: z.string(),
        wordCount: z.number().optional(),
        sceneCount: z.number().optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { chapterId, wordCount, sceneCount } = req.body;

    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter || chapter.novelId !== novelId) {
      return reply.status(404).send({ success: false, error: 'Chapter not found' });
    }

    const snapshot = await orchestrator.analyze(novelId, chapterId, chapter.number, {
      wordCount: wordCount ?? 0,
      sceneCount: sceneCount ?? 0,
    });

    return reply.send({ success: true, data: snapshot });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/quality/repair
  // Queue a manual quality repair for a chapter
  // =====================================================================
  app.post('/novels/:novelId/generation/quality/repair', {
    schema: {
      params: novelParams,
      body: z.object({
        chapterId: z.string(),
        chapterProseVersionId: z.string().optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { chapterId, chapterProseVersionId } = req.body;

    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter || chapter.novelId !== novelId) {
      return reply.status(404).send({ success: false, error: 'Chapter not found' });
    }

    // Find canonical prose version if not specified
    let proseVersionId = chapterProseVersionId;
    if (!proseVersionId) {
      const chapterProse = await db.chapterProse.findUnique({
        where: { chapterId },
        select: { currentVersionId: true },
      });
      proseVersionId = chapterProse?.currentVersionId ?? undefined;
    }

    if (!proseVersionId) {
      return reply.status(404).send({
        success: false,
        error: 'No canonical prose version found. Generate prose first.',
      });
    }

    // Trigger analysis which will plan + enqueue repair if needed
    const snapshot = await orchestrator.analyze(novelId, chapterId, chapter.number, {
      chapterProseVersionId: proseVersionId,
    });

    return reply.send({
      success: true,
      data: {
        snapshot: {
          healthStatus: snapshot.healthStatus,
          overallScore: snapshot.score.overall,
          issueCount: snapshot.issues.length,
        },
        message: snapshot.issues.length > 0
          ? `${snapshot.issues.length} issues detected. Repair job may have been queued.`
          : 'No issues detected — no repair needed.',
      },
    });
  });

  // =====================================================================
  // POST /novels/:novelId/generation/quality/retry-repair
  // Re-queue all FAILED QUALITY_REPAIR jobs
  // =====================================================================
  app.post('/novels/:novelId/generation/quality/retry-repair', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    // Find FAILED quality repair jobs via payload
    const failedJobs = await db.generationJob.findMany({
      where: {
        novelId,
        status: 'FAILED',
        input: { path: ['strategy'], not: undefined },
      },
      take: 20,
    });

    // Re-queue them
    const requeued = await db.generationJob.updateMany({
      where: {
        id: { in: failedJobs.map((j) => j.id) },
        status: 'FAILED',
      },
      data: { status: 'QUEUED', retryCount: 0, scheduledAt: new Date() },
    });

    return reply.send({
      success: true,
      data: { requeued: requeued.count },
    });
  });

  // =====================================================================
  // GET /novels/:novelId/generation/quality/chapter/:chapterNumber
  // Quality history for a specific chapter
  // =====================================================================
  app.get('/novels/:novelId/generation/quality/chapter/:chapterNumber', {
    schema: {
      params: novelParams.extend({ chapterNumber: z.coerce.number().int().min(1) }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { chapterNumber } = req.params as any;

    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const snapshots = await db.qualitySnapshotRecord.findMany({
      where: { novelId, chapterNumber: Number(chapterNumber) },
      orderBy: { createdAt: 'desc' },
      include: { issues: { select: { issueType: true, severity: true, resolved: true } } },
    });

    const repairs = await db.repairAttemptRecord.findMany({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return reply.send({
      success: true,
      data: {
        chapterNumber: Number(chapterNumber),
        snapshots: snapshots.map((s) => ({
          id: s.id,
          overallScore: s.overallScore,
          healthStatus: s.healthStatus,
          issueCount: s.issueCount,
          issues: s.issues,
          createdAt: s.createdAt,
        })),
        repairs,
      },
    });
  });
};
