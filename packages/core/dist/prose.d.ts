import { z } from 'zod';
export declare enum ProseStatus {
    DRAFT = "DRAFT",
    CANONICAL = "CANONICAL",
    STALE = "STALE",
    REJECTED = "REJECTED",
    HUMAN_EDITED = "HUMAN_EDITED"
}
export declare enum ProseStage {
    PROSE_GENERATION = "PROSE_GENERATION"
}
export declare const ValidationFailureSchema: z.ZodObject<{
    type: z.ZodEnum<{
        STRUCTURAL: "STRUCTURAL";
        CONTINUITY: "CONTINUITY";
        CONTENT: "CONTENT";
    }>;
    message: z.ZodString;
    severity: z.ZodEnum<{
        WARNING: "WARNING";
        ERROR: "ERROR";
    }>;
    details: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const ValidationReportSchema: z.ZodObject<{
    passed: z.ZodBoolean;
    score: z.ZodOptional<z.ZodNumber>;
    failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            STRUCTURAL: "STRUCTURAL";
            CONTINUITY: "CONTINUITY";
            CONTENT: "CONTENT";
        }>;
        message: z.ZodString;
        severity: z.ZodEnum<{
            WARNING: "WARNING";
            ERROR: "ERROR";
        }>;
        details: z.ZodOptional<z.ZodAny>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const StyleProfileSchema: z.ZodObject<{
    narrativeVoice: z.ZodString;
    povStyle: z.ZodString;
    tense: z.ZodEnum<{
        PAST: "PAST";
        PRESENT: "PRESENT";
    }>;
    dialogueDensity: z.ZodNumber;
    descriptionDensity: z.ZodNumber;
    pacing: z.ZodString;
    emotionalIntensity: z.ZodString;
    genreConventions: z.ZodArray<z.ZodString>;
    prohibitedPatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const GenerateSceneProseSchema: z.ZodObject<{
    content: z.ZodString;
    wordCount: z.ZodNumber;
}, z.core.$strip>;
