import { z } from 'zod';
export declare enum EntityType {
    CHARACTER = "CHARACTER",
    ITEM = "ITEM",
    LOCATION = "LOCATION",
    FACTION = "FACTION",
    PLOT_THREAD = "PLOT_THREAD",
    FORESHADOWING = "FORESHADOWING"
}
export declare enum SceneStage {
    SCENE_PLAN = "SCENE_PLAN"
}
export declare const StateChangeSchema: z.ZodObject<{
    entityType: z.ZodEnum<typeof EntityType>;
    entityId: z.ZodString;
    property: z.ZodString;
    previousValue: z.ZodNullable<z.ZodString>;
    newValue: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SceneSchema: z.ZodObject<{
    scenes: z.ZodArray<z.ZodObject<{
        sceneNumber: z.ZodNumber;
        function: z.ZodString;
        povCharacter: z.ZodNullable<z.ZodString>;
        location: z.ZodNullable<z.ZodString>;
        time: z.ZodNullable<z.ZodString>;
        objective: z.ZodNullable<z.ZodString>;
        conflict: z.ZodNullable<z.ZodString>;
        obstacle: z.ZodNullable<z.ZodString>;
        escalation: z.ZodNullable<z.ZodString>;
        turningPoint: z.ZodNullable<z.ZodString>;
        outcome: z.ZodNullable<z.ZodString>;
        emotionalBeat: z.ZodNullable<z.ZodString>;
        informationControl: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>;
        plotThreads: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>;
        foreshadowing: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>;
        transitionToNext: z.ZodNullable<z.ZodString>;
        stateChanges: z.ZodArray<z.ZodObject<{
            entityType: z.ZodEnum<typeof EntityType>;
            entityId: z.ZodString;
            property: z.ZodString;
            previousValue: z.ZodNullable<z.ZodString>;
            newValue: z.ZodString;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
