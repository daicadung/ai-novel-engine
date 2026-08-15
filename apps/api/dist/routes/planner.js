import { PlannerStage, JobType } from '@ane/core';
import { db } from '@ane/database';
import { QueueFactory } from '../services/queue/index.js';
export default async function plannerRoutes(fastify) {
    const queueManager = QueueFactory.getQueueManager();
    fastify.get('/:novelId/planner/status', async (request, reply) => {
        const { novelId } = request.params;
        const plan = await db.storyPlan.findUnique({ where: { novelId } });
        if (!plan)
            return { status: 'NOT_STARTED' };
        const version = await db.storyPlanVersion.findFirst({
            where: { planId: plan.id, isCanonical: true },
            orderBy: { version: 'desc' }
        });
        const activeJob = await db.generationJob.findFirst({
            where: { novelId, status: 'RUNNING', plannerStage: { not: null } }
        });
        return {
            planId: plan.id,
            activeVersion: version?.version,
            isGenerating: !!activeJob,
            activeStage: activeJob?.plannerStage
        };
    });
    fastify.post('/:novelId/planner/destination', async (request, reply) => {
        const { novelId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.DESTINATION });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
    fastify.post('/:novelId/planner/macro', async (request, reply) => {
        const { novelId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.MACRO });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
    fastify.post('/:novelId/planner/sagas', async (request, reply) => {
        const { novelId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.SAGA });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
    fastify.post('/:novelId/planner/sagas/:sagaId/arcs', async (request, reply) => {
        const { novelId, sagaId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.ARC, parentId: sagaId });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
    fastify.post('/:novelId/planner/arcs/:arcId/mini-arcs', async (request, reply) => {
        const { novelId, arcId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.MINI_ARC, parentId: arcId });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
    fastify.post('/:novelId/planner/mini-arcs/:miniArcId/chapters', async (request, reply) => {
        const { novelId, miniArcId } = request.params;
        const job = await queueManager.addJob(JobType.PLANNER_STAGE, { novelId, stage: PlannerStage.CHAPTER_BATCH, parentId: miniArcId });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
    });
}
