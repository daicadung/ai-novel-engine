import { db } from '@ane/database';
import * as Handlers from './handlers.js';
import { ProviderFactory } from '../llm/factory.js';
import { ArchitectStage, STAGE_REGISTRY } from '@ane/core';
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
                if (def.dependsOn.includes(current) && !visited.has(stage)) {
                    queue.push(stage);
                }
            }
        }
        return downstream;
    }
    async runStage(novelId, stage, config) {
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new Error("Novel not found");
        const handler = this.handlers.get(stage);
        if (!handler)
            throw new Error(`No handler for stage: ${stage}`);
        const job = await db.generationJob.create({
            data: {
                novelId,
                stage,
                status: 'RUNNING',
                provider: 'LLMProvider',
                startedAt: new Date()
            }
        });
        try {
            const prompt = await handler.prepareInput(novelId);
            const fullPrompt = `${prompt}\nSTAGE: ${stage}`;
            const data = await handler.invoke(fullPrompt, config);
            await db.$transaction(async (tx) => {
                await handler.applyCanonicalPersistence(novelId, data, tx);
                const downstream = this.getDownstreamStages(stage);
                for (const ds of downstream) {
                    const field = STAGE_REGISTRY[ds].stateField;
                    await tx.novel.update({
                        where: { id: novelId },
                        data: { [field]: 'STALE' }
                    });
                }
            });
            await db.generationJob.update({
                where: { id: job.id },
                data: { status: 'SUCCEEDED', output: data, completedAt: new Date() }
            });
            return data;
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
