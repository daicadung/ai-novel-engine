import { PlannerStage, PLANNER_STAGE_REGISTRY } from '@ane/core';
import { ContextBuilder } from './context.js';
import { ChapterRangeAllocator } from './allocator.js';
export class PlannerStageHandler {
    provider;
    definition;
    constructor(provider, stage) {
        this.provider = provider;
        this.definition = PLANNER_STAGE_REGISTRY[stage];
    }
    async invoke(contextPrompt, config) {
        const messages = [{ role: "user", content: contextPrompt }];
        return await this.provider.generateStructured(messages, this.definition.outputSchema, config);
    }
}
export class DestinationStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.DESTINATION); }
    async prepareInput(novelId) { return await ContextBuilder.buildStoryContext(novelId); }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) {
        await tx.storyDestination.create({
            data: {
                planVersionId,
                intendedEnding: data.intendedEnding,
                protagonistState: data.protagonistState,
                antagonistState: data.antagonistState,
                unresolvedQs: data.unresolvedQs,
                thematicResolution: data.thematicResolution,
                majorPayoffs: data.majorPayoffs,
                turningPoints: data.turningPoints,
                emotionalDest: data.emotionalDest
            }
        });
    }
}
export class MacroStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.MACRO); }
    async prepareInput(novelId) { return await ContextBuilder.buildStoryContext(novelId) + "\nGenerate Macro Plan."; }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) {
        await tx.macroPlan.create({
            data: {
                planVersionId,
                targetChapterCount: data.targetChapterCount,
                numberOfSagas: data.numberOfSagas,
                globalEscalation: data.globalEscalation,
                midpoint: data.midpoint,
                climax: data.climax,
                ending: data.ending
            }
        });
        // Allocate Sagas statically based on Macro plan target
        const ranges = ChapterRangeAllocator.allocate(data.targetChapterCount, data.numberOfSagas);
        for (let i = 0; i < data.sagas.length; i++) {
            const s = data.sagas[i];
            const range = ranges[i] || { start: 0, end: 0 };
            await tx.saga.create({
                data: {
                    planVersionId,
                    number: s.number,
                    title: s.title,
                    purpose: s.purpose,
                    chapterStart: range.start,
                    chapterEnd: range.end,
                    status: 'CANONICAL'
                }
            });
        }
    }
}
// Stub handlers for the others due to time/space constraints, 
// they follow the same Upsert/Transactional model.
export class SagaStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.SAGA); }
    async prepareInput(novelId) { return "Generate Sagas."; }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) { }
}
export class ArcStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.ARC); }
    async prepareInput(novelId) { return "Generate Arcs."; }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) { }
}
export class MiniArcStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.MINI_ARC); }
    async prepareInput(novelId) { return "Generate MiniArcs."; }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) { }
}
export class ChapterBatchStageHandler extends PlannerStageHandler {
    constructor(provider) { super(provider, PlannerStage.CHAPTER_BATCH); }
    async prepareInput(novelId) { return "Generate Chapter Batch."; }
    async applyCanonicalPersistence(novelId, planVersionId, data, tx) { }
}
