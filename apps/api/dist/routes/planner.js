import { PlannerStage } from '@ane/core';
import { StoryPlannerManager } from '../services/planner/manager.js';
import { db } from '@ane/database';
export default async function plannerRoutes(fastify) {
    const manager = new StoryPlannerManager();
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
        manager.runStage(novelId, PlannerStage.DESTINATION).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
    fastify.post('/:novelId/planner/macro', async (request, reply) => {
        const { novelId } = request.params;
        manager.runStage(novelId, PlannerStage.MACRO).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
    fastify.post('/:novelId/planner/sagas', async (request, reply) => {
        const { novelId } = request.params;
        manager.runStage(novelId, PlannerStage.SAGA).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
    fastify.post('/:novelId/planner/sagas/:sagaId/arcs', async (request, reply) => {
        const { novelId, sagaId } = request.params;
        manager.runStage(novelId, PlannerStage.ARC, sagaId).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
    fastify.post('/:novelId/planner/arcs/:arcId/mini-arcs', async (request, reply) => {
        const { novelId, arcId } = request.params;
        manager.runStage(novelId, PlannerStage.MINI_ARC, arcId).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
    fastify.post('/:novelId/planner/mini-arcs/:miniArcId/chapters', async (request, reply) => {
        const { novelId, miniArcId } = request.params;
        manager.runStage(novelId, PlannerStage.CHAPTER_BATCH, miniArcId).catch(console.error);
        return reply.status(202).send({ message: 'Generation started' });
    });
}
