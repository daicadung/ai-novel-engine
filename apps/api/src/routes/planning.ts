import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
import { LongHorizonPlanner } from '../services/planning/LongHorizonPlanner.js';
import { ChapterObjectivePlanner } from '../services/planning/ChapterObjectivePlanner.js';
import { PlanReconciler } from '../services/planning/PlanReconciler.js';
import { PlanningWindowBuilder } from '../services/planning/PlanningWindowBuilder.js';
import { DatabaseQueueManager } from '../services/queue/DatabaseQueueManager.js';
import { JobType } from '@ane/core';

const planner = new LongHorizonPlanner();
const objPlanner = new ChapterObjectivePlanner();
const reconciler = new PlanReconciler();
const windowBuilder = new PlanningWindowBuilder();
const queue = new DatabaseQueueManager();

export const planningRoutes: FastifyPluginAsyncZod = async (app) => {
  const novelParams = z.object({ novelId: z.string().uuid() });

  // ====================================================================
  // GET /novels/:novelId/generation/plan
  // Active long-horizon plan overview
  // ====================================================================
  app.get('/novels/:novelId/generation/plan', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const plan = await db.longHorizonPlan.findFirst({
      where: { novelId, status: { in: ['ACTIVE', 'DRAFT'] } },
      orderBy: { version: 'desc' },
      include: {
        arcPlans: { orderBy: { arcNumber: 'asc' }, select: {
          id: true, arcNumber: true, title: true, status: true,
          plannedChapterStart: true, plannedChapterEnd: true, priority: true,
        }},
        _count: { select: { objectives: true, reconciliations: true, decisions: true } },
      },
    });

    return reply.send({ success: true, data: plan });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/arcs
  // All story arcs in active plan
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/arcs', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const plan = await db.longHorizonPlan.findFirst({
      where: { novelId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });

    if (!plan) return reply.send({ success: true, data: [] });

    const arcs = await db.storyArcPlan.findMany({
      where: { longHorizonPlanId: plan.id },
      orderBy: { arcNumber: 'asc' },
      include: {
        milestones: { select: { id: true, title: true, status: true, priority: true } },
        _count: { select: { objectives: true } },
      },
    });

    return reply.send({ success: true, data: arcs });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/objectives
  // Chapter objectives (most recent)
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/objectives', {
    schema: {
      params: novelParams,
      querystring: z.object({ limit: z.coerce.number().default(20) }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { limit } = req.query;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const objectives = await db.chapterObjectiveRecord.findMany({
      where: { novelId },
      orderBy: { chapterNumber: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true, chapterNumber: true, status: true, completionScore: true,
        primaryObjective: true, tensionTarget: true, createdAt: true,
      },
    });

    return reply.send({ success: true, data: objectives });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/milestones
  // Narrative milestones
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/milestones', {
    schema: {
      params: novelParams,
      querystring: z.object({
        status: z.enum(['PLANNED', 'AVAILABLE', 'TRIGGERED', 'COMPLETED', 'MISSED', 'INVALIDATED']).optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { status } = req.query;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const milestones = await db.narrativeMilestoneRecord.findMany({
      where: { novelId, ...(status ? { status } : {}) },
      orderBy: [{ priority: 'desc' }, { plannedChapterMin: 'asc' }],
      take: 50,
    });

    return reply.send({ success: true, data: milestones });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/obligations
  // Narrative obligations
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/obligations', {
    schema: {
      params: novelParams,
      querystring: z.object({
        status: z.enum(['OPEN', 'PROGRESSING', 'SATISFIED', 'FAILED', 'INVALIDATED']).optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { status } = req.query;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const obligations = await db.narrativeObligationRecord.findMany({
      where: { novelId, ...(status ? { status } : {}) },
      orderBy: [{ priority: 'desc' }, { establishedChapter: 'asc' }],
      take: 50,
    });

    return reply.send({ success: true, data: obligations });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/foreshadowing
  // Foreshadowing plans
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/foreshadowing', {
    schema: {
      params: novelParams,
      querystring: z.object({
        status: z.enum(['PLANNED', 'ACTIVE', 'PAID_OFF', 'FORGOTTEN', 'CANCELLED']).optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { status } = req.query;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const foreshadowing = await db.foreshadowingPlanRecord.findMany({
      where: { novelId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { payoffWindowStart: 'asc' }],
      take: 50,
    });

    return reply.send({ success: true, data: foreshadowing });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/character-arcs
  // Character arc plans
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/character-arcs', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const arcs = await db.phase11CharacterArcPlan.findMany({
      where: { novelId },
      orderBy: [{ status: 'asc' }, { progressScore: 'desc' }],
      take: 30,
    });

    return reply.send({ success: true, data: arcs });
  });

  // ====================================================================
  // GET /novels/:novelId/generation/plan/history
  // Planning decision history
  // ====================================================================
  app.get('/novels/:novelId/generation/plan/history', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const decisions = await db.planningDecisionRecord.findMany({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, decisionType: true, summary: true, wasLLMAssisted: true,
        validationPassed: true, affectedChapterMin: true, affectedChapterMax: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: decisions });
  });

  // ====================================================================
  // POST /novels/:novelId/generation/plan/analyze
  // Trigger initial long-horizon plan creation
  // ====================================================================
  app.post('/novels/:novelId/generation/plan/analyze', {
    schema: { params: novelParams },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    // Queue a STORY_PLANNING job via existing queue
    const job = await queue.addJob(JobType.STORY_PLANNING, {
      novelId,
      operation: 'initial',
    }, {
      jobId: `story-plan-initial-${novelId}`,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, message: 'Initial planning job queued' },
    });
  });

  // ====================================================================
  // POST /novels/:novelId/generation/plan/replan
  // Trigger replanning
  // ====================================================================
  app.post('/novels/:novelId/generation/plan/replan', {
    schema: {
      params: novelParams,
      body: z.object({
        reason: z.string().min(5),
        currentChapter: z.number().int().min(1),
        longHorizonPlanId: z.string(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { reason, currentChapter, longHorizonPlanId } = req.body;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const job = await queue.addJob(JobType.STORY_PLANNING, {
      novelId,
      operation: 'replan',
      longHorizonPlanId,
      chapterNumber: currentChapter,
    }, {
      jobId: `story-replan-${novelId}-ch${currentChapter}`,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, message: 'Replanning job queued' },
    });
  });

  // ====================================================================
  // POST /novels/:novelId/generation/plan/approve
  // Approve a DRAFT plan (activate it)
  // ====================================================================
  app.post('/novels/:novelId/generation/plan/approve', {
    schema: {
      params: novelParams,
      body: z.object({ planId: z.string() }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { planId } = req.body;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const plan = await db.longHorizonPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.novelId !== novelId) {
      return reply.status(404).send({ success: false, error: 'Plan not found' });
    }
    if (plan.status !== 'DRAFT') {
      return reply.status(400).send({ success: false, error: `Plan is already ${plan.status}` });
    }

    await planner.approvePlan(novelId, planId);

    return reply.send({
      success: true,
      data: { planId, status: 'ACTIVE', message: 'Plan approved and activated' },
    });
  });

  // ====================================================================
  // POST /novels/:novelId/generation/plan/reconcile
  // Trigger post-chapter reconciliation
  // ====================================================================
  app.post('/novels/:novelId/generation/plan/reconcile', {
    schema: {
      params: novelParams,
      body: z.object({
        chapterNumber: z.number().int().min(1),
        longHorizonPlanId: z.string(),
        chapterObjectiveId: z.string(),
        actualKeyEvents: z.array(z.string()).optional(),
      }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { chapterNumber, longHorizonPlanId, chapterObjectiveId, actualKeyEvents } = req.body;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const result = await reconciler.reconcile(novelId, chapterNumber, {
      longHorizonPlanId,
      chapterObjectiveId,
      actualKeyEvents: actualKeyEvents ?? [],
      actualStateDeltas: [],
    });

    return reply.send({ success: true, data: result });
  });

  // ====================================================================
  // POST /novels/:novelId/generation/plan/repair
  // Trigger milestone recovery
  // ====================================================================
  app.post('/novels/:novelId/generation/plan/repair', {
    schema: {
      params: novelParams,
      body: z.object({ longHorizonPlanId: z.string() }),
    },
  }, async (req, reply) => {
    const { novelId } = req.params;
    const { longHorizonPlanId } = req.body;
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) throw new NotFoundError('Novel not found');

    const job = await queue.addJob(JobType.STORY_PLANNING, {
      novelId,
      operation: 'milestone_recovery',
      longHorizonPlanId,
    }, {
      jobId: `milestone-recovery-${novelId}-${longHorizonPlanId}`,
    });

    return reply.status(202).send({
      success: true,
      data: { jobId: job.id, message: 'Milestone recovery job queued' },
    });
  });
};
