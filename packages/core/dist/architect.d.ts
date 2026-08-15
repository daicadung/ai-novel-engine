import { z } from "zod";
export declare enum ArchitectStage {
    CONCEPT = "CONCEPT",
    PREMISE = "PREMISE",
    GENRE_AND_TONE = "GENRE_AND_TONE",
    THEMES = "THEMES",
    WORLD = "WORLD",
    POWER_SYSTEM = "POWER_SYSTEM",
    CHARACTERS = "CHARACTERS",
    FACTIONS = "FACTIONS",
    CONFLICTS = "CONFLICTS",
    PLOT_THREADS = "PLOT_THREADS",
    CHARACTER_ARCS = "CHARACTER_ARCS",
    FORESHADOWING = "FORESHADOWING",
    LONG_TERM_STRUCTURE = "LONG_TERM_STRUCTURE",
    STORY_BIBLE_FINALIZATION = "STORY_BIBLE_FINALIZATION"
}
export declare enum ArchitectStatus {
    NOT_STARTED = "NOT_STARTED",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    STALE = "STALE"
}
export declare const ConceptSchema: z.ZodObject<{
    title: z.ZodString;
    hook: z.ZodString;
    premise: z.ZodString;
    genreCandidates: z.ZodArray<z.ZodString>;
    toneCandidates: z.ZodArray<z.ZodString>;
    targetAudience: z.ZodString;
    coreConflict: z.ZodString;
    uniqueSellingProposition: z.ZodString;
}, z.core.$strip>;
export declare const PremiseSchema: z.ZodObject<{
    logline: z.ZodString;
    shortPremise: z.ZodString;
    extendedPremise: z.ZodString;
    protagonistSituation: z.ZodString;
    centralConflict: z.ZodString;
    stakes: z.ZodString;
    storyPromise: z.ZodString;
}, z.core.$strip>;
export declare const ThemesSchema: z.ZodObject<{
    themes: z.ZodArray<z.ZodObject<{
        theme: z.ZodString;
        description: z.ZodString;
        narrativePurpose: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const GenreToneSchema: z.ZodObject<{
    genre: z.ZodObject<{
        primary: z.ZodString;
        secondary: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    tone: z.ZodObject<{
        primary: z.ZodString;
        secondary: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    themes: z.ZodArray<z.ZodObject<{
        theme: z.ZodString;
        description: z.ZodString;
        narrativePurpose: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WorldSchema: z.ZodObject<{
    overview: z.ZodString;
    geography: z.ZodString;
    civilizations: z.ZodArray<z.ZodString>;
    technology: z.ZodString;
    history: z.ZodString;
    locations: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PowerSystemSchema: z.ZodObject<{
    name: z.ZodString;
    source: z.ZodString;
    rules: z.ZodArray<z.ZodString>;
    limitations: z.ZodArray<z.ZodString>;
    costs: z.ZodArray<z.ZodString>;
    tiers: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const CharactersSchema: z.ZodObject<{
    characters: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        role: z.ZodString;
        personality: z.ZodString;
        fears: z.ZodString;
        desires: z.ZodString;
        backstory: z.ZodString;
        goals: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const FactionsSchema: z.ZodObject<{
    factions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        ideology: z.ZodString;
        goals: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ConflictsSchema: z.ZodObject<{
    central: z.ZodString;
    internal: z.ZodArray<z.ZodString>;
    external: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const PlotThreadsSchema: z.ZodObject<{
    threads: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        setup: z.ZodString;
        resolution: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CharacterArcsSchema: z.ZodObject<{
    arcs: z.ZodArray<z.ZodObject<{
        characterName: z.ZodString;
        startingState: z.ZodString;
        transformation: z.ZodString;
        endingState: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ForeshadowingSchema: z.ZodObject<{
    hints: z.ZodArray<z.ZodObject<{
        setup: z.ZodString;
        payoff: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const LongTermStructureSchema: z.ZodObject<{
    numberOfSagas: z.ZodNumber;
    sagas: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        purpose: z.ZodString;
        majorTurningPoint: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const StoryBibleFinalizationSchema: z.ZodObject<{
    version: z.ZodNumber;
    logline: z.ZodString;
    synopsis: z.ZodString;
}, z.core.$strip>;
export type StageDefinition = {
    stage: ArchitectStage;
    dependencies: ArchitectStage[];
    inputSchema?: z.ZodType<any>;
    outputSchema: z.ZodType<any>;
};
export declare const STAGE_REGISTRY: Record<ArchitectStage, StageDefinition>;
