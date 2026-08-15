import { db } from '@ane/database';
import * as Handlers from './handlers.js';
import { ProviderFactory } from '../llm/factory.js';
import { PlannerStage } from '@ane/core';
import { LLMUsageProxy } from '../generation/LLMUsageProxy.js';
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
    /**
     * Execute a planner stage.
     * NOTE: GenerationJob must already exist (created by DatabaseQueueManager).
     * This method executes the domain work. Job status updates are owned by ServerlessJobProcessor.
     *
     * @param novelId   - The novel being planned
     * @param stage     - The PlannerStage to run
     * @param parentId  - Optional parent ID (for SAGA/ARC/MINI_ARC)
     * @param jobId     - Optional existing GenerationJob ID for usage tracking
     */
    async runStage(novelId, stage, parentId, jobId) {
        const handler = this.handlers.get(stage);
        if (!handler)
            throw new Error('No handler found for stage: ' + stage);
        // Concurrency guard — prevent double-execution when multiple workers pick up the same stage
        // (In practice, FOR UPDATE SKIP LOCKED prevents this, but defend in depth)
        const runningJob = await db.generationJob.findFirst({
            where: {
                novelId,
                plannerStage: stage,
                status: { in: ['RUNNING', 'CLAIMED'] },
                id: { not: jobId ?? '' }
            }
        });
        if (runningJob) {
            throw new Error(`Planner stage ${stage} is already being processed by job ${runningJob.id}`);
        }
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
        const originalProvider = handler.provider;
        // Wrap with usage proxy if we have a jobId
        if (jobId) {
            handler.provider = new LLMUsageProxy(originalProvider, originalProvider.getProviderName(), novelId, stage, undefined, jobId);
        }
        try {
            const prompt = await handler.prepareInput(novelId, parentId);
            const fullPrompt = `${prompt}\nPLANNER_STAGE: ${stage}`;
            const output = await handler.invoke(fullPrompt);
            // Transactional canonical persistence — historical versions are NEVER deleted
            await db.$transaction(async (tx) => {
                await handler.applyCanonicalPersistence(novelId, activeVersion.id, output, tx, parentId);
            });
            return;
        }
        finally {
            handler.provider = originalProvider;
        }
    }
}
