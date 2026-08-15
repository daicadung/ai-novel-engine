import { z } from 'zod';
export var PlanStatus;
(function (PlanStatus) {
    PlanStatus["DRAFT"] = "DRAFT";
    PlanStatus["CANONICAL"] = "CANONICAL";
    PlanStatus["STALE"] = "STALE";
})(PlanStatus || (PlanStatus = {}));
export var PlannerStage;
(function (PlannerStage) {
    PlannerStage["DESTINATION"] = "DESTINATION";
    PlannerStage["MACRO"] = "MACRO";
    PlannerStage["SAGA"] = "SAGA";
    PlannerStage["ARC"] = "ARC";
    PlannerStage["MINI_ARC"] = "MINI_ARC";
    PlannerStage["CHAPTER_BATCH"] = "CHAPTER_BATCH";
})(PlannerStage || (PlannerStage = {}));
export const StoryDestinationSchema = z.object({
    intendedEnding: z.string(),
    protagonistState: z.string(),
    antagonistState: z.string(),
    unresolvedQs: z.string(),
    thematicResolution: z.string(),
    majorPayoffs: z.string(),
    turningPoints: z.string(),
    emotionalDest: z.string()
});
export const MacroPlanSchema = z.object({
    targetChapterCount: z.number(),
    numberOfSagas: z.number(),
    globalEscalation: z.string(),
    midpoint: z.string(),
    climax: z.string(),
    ending: z.string(),
    sagas: z.array(z.object({
        number: z.number(),
        title: z.string(),
        purpose: z.string()
    }))
});
export const SagaSchema = z.object({
    sagas: z.array(z.object({
        number: z.number(),
        title: z.string(),
        purpose: z.string(),
        primaryConflict: z.string(),
        resolution: z.string(),
        unresolvedHooks: z.string()
    }))
});
export const ArcSchema = z.object({
    arcs: z.array(z.object({
        number: z.number(),
        title: z.string(),
        summary: z.string(),
        objective: z.string(),
        conflict: z.string(),
        chapterStart: z.number().optional(),
        chapterEnd: z.number().optional()
    }))
});
export const MiniArcSchema = z.object({
    miniArcs: z.array(z.object({
        number: z.number(),
        title: z.string(),
        purpose: z.string(),
        chapterStart: z.number().optional(),
        chapterEnd: z.number().optional(),
        conflict: z.string(),
        objective: z.string(),
        turningPoint: z.string(),
        payoff: z.string(),
        consequence: z.string()
    }))
});
export const ChapterBatchSchema = z.object({
    chapters: z.array(z.object({
        number: z.number(),
        title: z.string(),
        purpose: z.string(),
        povCharacter: z.string(),
        location: z.string(),
        activeCharacters: z.array(z.string()),
        activePlotThreads: z.array(z.string()),
        activeConflicts: z.array(z.string()),
        setup: z.string(),
        progression: z.string(),
        turningPoint: z.string(),
        endingHook: z.string(),
        foreshadowingUsed: z.array(z.string()),
        foreshadowingCreated: z.array(z.string()),
        characterDevelopment: z.string(),
        continuityRequirements: z.string(),
        consequences: z.string()
    }))
});
export const PLANNER_STAGE_REGISTRY = {
    [PlannerStage.DESTINATION]: { stage: PlannerStage.DESTINATION, outputSchema: StoryDestinationSchema },
    [PlannerStage.MACRO]: { stage: PlannerStage.MACRO, outputSchema: MacroPlanSchema },
    [PlannerStage.SAGA]: { stage: PlannerStage.SAGA, outputSchema: SagaSchema },
    [PlannerStage.ARC]: { stage: PlannerStage.ARC, outputSchema: ArcSchema },
    [PlannerStage.MINI_ARC]: { stage: PlannerStage.MINI_ARC, outputSchema: MiniArcSchema },
    [PlannerStage.CHAPTER_BATCH]: { stage: PlannerStage.CHAPTER_BATCH, outputSchema: ChapterBatchSchema }
};
