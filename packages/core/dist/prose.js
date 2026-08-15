import { z } from 'zod';
export var ProseStatus;
(function (ProseStatus) {
    ProseStatus["DRAFT"] = "DRAFT";
    ProseStatus["CANONICAL"] = "CANONICAL";
    ProseStatus["STALE"] = "STALE";
    ProseStatus["REJECTED"] = "REJECTED";
    ProseStatus["HUMAN_EDITED"] = "HUMAN_EDITED";
})(ProseStatus || (ProseStatus = {}));
export var ProseStage;
(function (ProseStage) {
    ProseStage["PROSE_GENERATION"] = "PROSE_GENERATION";
})(ProseStage || (ProseStage = {}));
export const ValidationFailureSchema = z.object({
    type: z.enum(['STRUCTURAL', 'CONTINUITY', 'CONTENT']),
    message: z.string(),
    severity: z.enum(['WARNING', 'ERROR']),
    details: z.any().optional()
});
export const ValidationReportSchema = z.object({
    passed: z.boolean(),
    score: z.number().min(0).max(100).optional(),
    failures: z.array(ValidationFailureSchema).optional()
});
export const StyleProfileSchema = z.object({
    narrativeVoice: z.string(),
    povStyle: z.string(),
    tense: z.enum(['PAST', 'PRESENT']),
    dialogueDensity: z.number().min(0).max(100),
    descriptionDensity: z.number().min(0).max(100),
    pacing: z.string(),
    emotionalIntensity: z.string(),
    genreConventions: z.array(z.string()),
    prohibitedPatterns: z.array(z.string()).optional()
});
export const GenerateSceneProseSchema = z.object({
    content: z.string(),
    wordCount: z.number()
});
