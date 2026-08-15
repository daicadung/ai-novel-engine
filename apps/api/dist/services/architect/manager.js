import { db } from '@ane/database';
import * as Handlers from './handlers.js';
import { ProviderFactory } from '../llm/factory.js';
import { ArchitectStage, ArchitectStatus, STAGE_REGISTRY } from '@ane/core';
import { LLMUsageProxy } from '../generation/LLMUsageProxy.js';
export class ArchitectManager {
    provider;
    handlers;
    constructor(provider) {
        this.provider = provider || ProviderFactory.getProvider('ARCHITECT');
        this.handlers = new Map();
        this.handlers.set(ArchitectStage.CONCEPT, new Handlers.ConceptStageHandler(this.provider));
        this.handlers.set(ArchitectStage.PREMISE, new Handlers.PremiseStageHandler(this.provider));
        this.handlers.set(ArchitectStage.GENRE_AND_TONE, new Handlers.GenreToneStageHandler(this.provider));
        this.handlers.set(ArchitectStage.THEMES, new Handlers.ThemesStageHandler(this.provider));
        this.handlers.set(ArchitectStage.WORLD, new Handlers.WorldStageHandler(this.provider));
        this.handlers.set(ArchitectStage.POWER_SYSTEM, new Handlers.PowerSystemStageHandler(this.provider));
        this.handlers.set(ArchitectStage.CHARACTERS, new Handlers.CharactersStageHandler(this.provider));
        this.handlers.set(ArchitectStage.FACTIONS, new Handlers.FactionsStageHandler(this.provider));
        this.handlers.set(ArchitectStage.CONFLICTS, new Handlers.ConflictsStageHandler(this.provider));
        this.handlers.set(ArchitectStage.PLOT_THREADS, new Handlers.PlotThreadsStageHandler(this.provider));
        this.handlers.set(ArchitectStage.CHARACTER_ARCS, new Handlers.CharacterArcsStageHandler(this.provider));
        this.handlers.set(ArchitectStage.FORESHADOWING, new Handlers.ForeshadowingStageHandler(this.provider));
        this.handlers.set(ArchitectStage.LONG_TERM_STRUCTURE, new Handlers.LongTermStructureStageHandler(this.provider));
        this.handlers.set(ArchitectStage.STORY_BIBLE_FINALIZATION, new Handlers.StoryBibleFinalizationStageHandler(this.provider));
    }
    getDownstreamStages(targetStage) {
        const queue = [targetStage];
        const visited = new Set();
        const downstream = [];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            if (current !== targetStage) {
                downstream.push(current);
            }
            for (const [stage, def] of Object.entries(STAGE_REGISTRY)) {
                if (def.dependencies.includes(current) && !visited.has(stage)) {
                    queue.push(stage);
                }
            }
        }
        return downstream;
    }
    /**
     * Execute an architect stage.
     * NOTE: GenerationJob must already exist (created by DatabaseQueueManager).
     * This method executes the domain work and updates the existing job.
     *
     * @param novelId  - The novel to architect
     * @param stage    - The ArchitectStage to run
     * @param isRetry  - Whether this is a retry
     * @param jobId    - Optional: existing GenerationJob ID for usage tracking
     */
    async runStage(novelId, stage, isRetry = false, jobId) {
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new Error('Novel not found');
        const handler = this.handlers.get(stage);
        if (!handler)
            throw new Error(`No handler for stage: ${stage}`);
        const originalProvider = handler.provider;
        // Wrap with usage proxy if we have a jobId
        if (jobId) {
            handler.provider = new LLMUsageProxy(originalProvider, originalProvider.getProviderName(), novelId, stage, undefined, jobId);
        }
        try {
            const prompt = await handler.prepareInput(novelId);
            const fullPrompt = `${prompt}\nSTAGE: ${stage}`;
            const data = await handler.invoke(fullPrompt);
            await db.$transaction(async (tx) => {
                await handler.applyCanonicalPersistence(novelId, data, tx);
                const downstream = this.getDownstreamStages(stage);
                if (downstream.length > 0) {
                    await tx.novel.update({
                        where: { id: novelId },
                        data: { architectStatus: ArchitectStatus.STALE }
                    });
                }
            });
            return data;
        }
        finally {
            handler.provider = originalProvider;
        }
    }
}
