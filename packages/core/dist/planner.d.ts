import { z } from 'zod';
export declare enum PlanStatus {
    DRAFT = "DRAFT",
    CANONICAL = "CANONICAL",
    STALE = "STALE"
}
export declare enum PlannerStage {
    DESTINATION = "DESTINATION",
    MACRO = "MACRO",
    SAGA = "SAGA",
    ARC = "ARC",
    MINI_ARC = "MINI_ARC",
    CHAPTER_BATCH = "CHAPTER_BATCH"
}
export declare const StoryDestinationSchema: z.ZodObject<{
    intendedEnding: z.ZodString;
    protagonistState: z.ZodString;
    antagonistState: z.ZodString;
    unresolvedQs: z.ZodString;
    thematicResolution: z.ZodString;
    majorPayoffs: z.ZodString;
    turningPoints: z.ZodString;
    emotionalDest: z.ZodString;
}, z.core.$strip>;
export declare const MacroPlanSchema: z.ZodObject<{
    targetChapterCount: z.ZodNumber;
    numberOfSagas: z.ZodNumber;
    globalEscalation: z.ZodString;
    midpoint: z.ZodString;
    climax: z.ZodString;
    ending: z.ZodString;
    sagas: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        purpose: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SagaSchema: z.ZodObject<{
    sagas: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        purpose: z.ZodString;
        primaryConflict: z.ZodString;
        resolution: z.ZodString;
        unresolvedHooks: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ArcSchema: z.ZodObject<{
    arcs: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        summary: z.ZodString;
        objective: z.ZodString;
        conflict: z.ZodString;
        chapterStart: z.ZodOptional<z.ZodNumber>;
        chapterEnd: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const MiniArcSchema: z.ZodObject<{
    miniArcs: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        purpose: z.ZodString;
        chapterStart: z.ZodOptional<z.ZodNumber>;
        chapterEnd: z.ZodOptional<z.ZodNumber>;
        conflict: z.ZodString;
        objective: z.ZodString;
        turningPoint: z.ZodString;
        payoff: z.ZodString;
        consequence: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ChapterBatchSchema: z.ZodObject<{
    chapters: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        purpose: z.ZodString;
        povCharacter: z.ZodString;
        location: z.ZodString;
        activeCharacters: z.ZodArray<z.ZodString>;
        activePlotThreads: z.ZodArray<z.ZodString>;
        activeConflicts: z.ZodArray<z.ZodString>;
        setup: z.ZodString;
        progression: z.ZodString;
        turningPoint: z.ZodString;
        endingHook: z.ZodString;
        foreshadowingUsed: z.ZodArray<z.ZodString>;
        foreshadowingCreated: z.ZodArray<z.ZodString>;
        characterDevelopment: z.ZodString;
        continuityRequirements: z.ZodString;
        consequences: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PLANNER_STAGE_REGISTRY: Record<PlannerStage, {
    stage: PlannerStage;
    outputSchema: z.ZodTypeAny;
}>;
