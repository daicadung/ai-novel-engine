import { db } from '@ane/database';
import * as Handlers from './handlers.js';
import { ProviderFactory } from '../llm/factory.js';
import { PlannerStage } from '@ane/core';
export class StoryPlannerManager {
    provider;
    handlers;
    constructor(provider) {
        this.provider = provider || ProviderFactory.getProvider('PLANNER');
        this.handlers = new Map();
        this.handlers.set(PlannerStage.DESTINATION, new Handlers.DestinationStageHandler(this.provider));
        this.handlers.set(PlannerStage.MACRO, new Handlers.MacroStageHandler(this.provider));
        this.handlers.set(PlannerStage.SAGA, new Handlers.SagaStageHandler(this.provider));
        this.handlers.set(PlannerStage.ARC, new Handlers.ArcStageHandler(this.provider));
        this.handlers.set(PlannerStage.MINI_ARC, new Handlers.MiniArcStageHandler(this.provider));
        this.handlers.set(PlannerStage.CHAPTER_BATCH, new Handlers.ChapterBatchStageHandler(this.provider));
    }
    async runStage(novelId, stage, parentId) {
        const handler = this.handlers.get(stage);
        if (!handler)
            throw new Error("No handler found for stage: " + stage);
        // Concurrency check
        const activeJob = await db.generationJob.findFirst({
            where: { novelId, plannerStage: stage, status: 'RUNNING' }
        });
        if (activeJob)
            throw new Error("Stage is already running: " + stage);
        // Get active StoryPlanVersion or create v1
        let plan = await db.storyPlan.findUnique({ where: { novelId } });
        if (!plan) {
            plan = await db.storyPlan.create({ data: { novelId } });
        }
        let activeVersion = await db.storyPlanVersion.findFirst({
            where: { planId: plan.id, isCanonical: true },
            orderBy: { version: 'desc' }
        });
        if (!activeVersion) {
            activeVersion = await db.storyPlanVersion.create({
                data: { planId: plan.id, version: 1, isCanonical: true }
            });
        }
        const job = await db.generationJob.create({
            data: {
                novelId,
                plannerStage: stage,
                status: 'RUNNING',
                provider: 'MockProvider',
                startedAt: new Date()
            }
        });
        try {
            const prompt = await handler.prepareInput(novelId, parentId);
            const fullPrompt = `${prompt}\nPLANNER_STAGE: ${stage}`;
            const output = await handler.invoke(fullPrompt);
            // We run in a transaction to safely promote candidate
            await db.$transaction(async (tx) => {
                await handler.applyCanonicalPersistence(novelId, activeVersion.id, output, tx, parentId);
            });
            await db.generationJob.update({
                where: { id: job.id },
                data: { status: 'SUCCEEDED', output: output, completedAt: new Date() }
            });
        }
        catch (e) {
            await db.generationJob.update({
                where: { id: job.id },
                data: { status: 'FAILED', error: { message: e.message }, completedAt: new Date() }
            });
            throw e;
        }
    }
}
