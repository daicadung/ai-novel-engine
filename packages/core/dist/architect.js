import { z } from "zod";
export var ArchitectStage;
(function (ArchitectStage) {
    ArchitectStage["CONCEPT"] = "CONCEPT";
    ArchitectStage["PREMISE"] = "PREMISE";
    ArchitectStage["GENRE_AND_TONE"] = "GENRE_AND_TONE";
    ArchitectStage["THEMES"] = "THEMES";
    ArchitectStage["WORLD"] = "WORLD";
    ArchitectStage["POWER_SYSTEM"] = "POWER_SYSTEM";
    ArchitectStage["CHARACTERS"] = "CHARACTERS";
    ArchitectStage["FACTIONS"] = "FACTIONS";
    ArchitectStage["CONFLICTS"] = "CONFLICTS";
    ArchitectStage["PLOT_THREADS"] = "PLOT_THREADS";
    ArchitectStage["CHARACTER_ARCS"] = "CHARACTER_ARCS";
    ArchitectStage["FORESHADOWING"] = "FORESHADOWING";
    ArchitectStage["LONG_TERM_STRUCTURE"] = "LONG_TERM_STRUCTURE";
    ArchitectStage["STORY_BIBLE_FINALIZATION"] = "STORY_BIBLE_FINALIZATION";
})(ArchitectStage || (ArchitectStage = {}));
export var ArchitectStatus;
(function (ArchitectStatus) {
    ArchitectStatus["NOT_STARTED"] = "NOT_STARTED";
    ArchitectStatus["RUNNING"] = "RUNNING";
    ArchitectStatus["COMPLETED"] = "COMPLETED";
    ArchitectStatus["FAILED"] = "FAILED";
    ArchitectStatus["STALE"] = "STALE";
})(ArchitectStatus || (ArchitectStatus = {}));
// ==========================================
// SCHEMAS
// ==========================================
export const ConceptSchema = z.object({
    title: z.string(),
    hook: z.string(),
    premise: z.string(),
    genreCandidates: z.array(z.string()),
    toneCandidates: z.array(z.string()),
    targetAudience: z.string(),
    coreConflict: z.string(),
    uniqueSellingProposition: z.string()
});
export const PremiseSchema = z.object({
    logline: z.string(),
    shortPremise: z.string(),
    extendedPremise: z.string(),
    protagonistSituation: z.string(),
    centralConflict: z.string(),
    stakes: z.string(),
    storyPromise: z.string()
});
export const ThemesSchema = z.object({
    themes: z.array(z.object({
        theme: z.string(),
        description: z.string(),
        narrativePurpose: z.string()
    }))
});
export const GenreToneSchema = z.object({
    genre: z.object({
        primary: z.string(),
        secondary: z.array(z.string())
    }),
    tone: z.object({
        primary: z.string(),
        secondary: z.array(z.string())
    }),
    themes: z.array(z.object({
        theme: z.string(),
        description: z.string(),
        narrativePurpose: z.string()
    }))
});
export const WorldSchema = z.object({
    overview: z.string(),
    geography: z.string(),
    civilizations: z.array(z.string()),
    technology: z.string(),
    history: z.string(),
    locations: z.array(z.object({
        name: z.string(),
        description: z.string()
    }))
});
export const PowerSystemSchema = z.object({
    name: z.string(),
    source: z.string(),
    rules: z.array(z.string()),
    limitations: z.array(z.string()),
    costs: z.array(z.string()),
    tiers: z.array(z.string())
});
export const CharactersSchema = z.object({
    characters: z.array(z.object({
        name: z.string(),
        role: z.string(),
        personality: z.string(),
        fears: z.string(),
        desires: z.string(),
        backstory: z.string(),
        goals: z.string()
    }))
});
export const FactionsSchema = z.object({
    factions: z.array(z.object({
        name: z.string(),
        ideology: z.string(),
        goals: z.string()
    }))
});
export const ConflictsSchema = z.object({
    central: z.string(),
    internal: z.array(z.string()),
    external: z.array(z.string())
});
export const PlotThreadsSchema = z.object({
    threads: z.array(z.object({
        title: z.string(),
        description: z.string(),
        setup: z.string(),
        resolution: z.string()
    }))
});
export const CharacterArcsSchema = z.object({
    arcs: z.array(z.object({
        characterName: z.string(),
        startingState: z.string(),
        transformation: z.string(),
        endingState: z.string()
    }))
});
export const ForeshadowingSchema = z.object({
    hints: z.array(z.object({
        setup: z.string(),
        payoff: z.string()
    }))
});
export const LongTermStructureSchema = z.object({
    numberOfSagas: z.number(),
    sagas: z.array(z.object({
        name: z.string(),
        purpose: z.string(),
        majorTurningPoint: z.string()
    }))
});
export const StoryBibleFinalizationSchema = z.object({
    version: z.number(),
    logline: z.string(),
    synopsis: z.string()
});
export const STAGE_REGISTRY = {
    [ArchitectStage.CONCEPT]: {
        stage: ArchitectStage.CONCEPT,
        dependencies: [],
        outputSchema: ConceptSchema
    },
    [ArchitectStage.PREMISE]: {
        stage: ArchitectStage.PREMISE,
        dependencies: [ArchitectStage.CONCEPT],
        outputSchema: PremiseSchema
    },
    [ArchitectStage.GENRE_AND_TONE]: {
        stage: ArchitectStage.GENRE_AND_TONE,
        dependencies: [ArchitectStage.PREMISE],
        outputSchema: GenreToneSchema
    },
    [ArchitectStage.THEMES]: {
        stage: ArchitectStage.THEMES,
        dependencies: [ArchitectStage.GENRE_AND_TONE],
        outputSchema: ThemesSchema
    },
    [ArchitectStage.WORLD]: {
        stage: ArchitectStage.WORLD,
        dependencies: [ArchitectStage.PREMISE, ArchitectStage.GENRE_AND_TONE],
        outputSchema: WorldSchema
    },
    [ArchitectStage.POWER_SYSTEM]: {
        stage: ArchitectStage.POWER_SYSTEM,
        dependencies: [ArchitectStage.WORLD],
        outputSchema: PowerSystemSchema
    },
    [ArchitectStage.CHARACTERS]: {
        stage: ArchitectStage.CHARACTERS,
        dependencies: [ArchitectStage.WORLD],
        outputSchema: CharactersSchema
    },
    [ArchitectStage.FACTIONS]: {
        stage: ArchitectStage.FACTIONS,
        dependencies: [ArchitectStage.WORLD],
        outputSchema: FactionsSchema
    },
    [ArchitectStage.CONFLICTS]: {
        stage: ArchitectStage.CONFLICTS,
        dependencies: [ArchitectStage.CHARACTERS, ArchitectStage.FACTIONS],
        outputSchema: ConflictsSchema
    },
    [ArchitectStage.PLOT_THREADS]: {
        stage: ArchitectStage.PLOT_THREADS,
        dependencies: [ArchitectStage.CONFLICTS],
        outputSchema: PlotThreadsSchema
    },
    [ArchitectStage.CHARACTER_ARCS]: {
        stage: ArchitectStage.CHARACTER_ARCS,
        dependencies: [ArchitectStage.PLOT_THREADS, ArchitectStage.CHARACTERS],
        outputSchema: CharacterArcsSchema
    },
    [ArchitectStage.FORESHADOWING]: {
        stage: ArchitectStage.FORESHADOWING,
        dependencies: [ArchitectStage.PLOT_THREADS],
        outputSchema: ForeshadowingSchema
    },
    [ArchitectStage.LONG_TERM_STRUCTURE]: {
        stage: ArchitectStage.LONG_TERM_STRUCTURE,
        dependencies: [ArchitectStage.PLOT_THREADS, ArchitectStage.CHARACTER_ARCS],
        outputSchema: LongTermStructureSchema
    },
    [ArchitectStage.STORY_BIBLE_FINALIZATION]: {
        stage: ArchitectStage.STORY_BIBLE_FINALIZATION,
        dependencies: [ArchitectStage.LONG_TERM_STRUCTURE],
        outputSchema: StoryBibleFinalizationSchema
    }
};
