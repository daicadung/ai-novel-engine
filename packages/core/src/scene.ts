import { z } from 'zod';

export enum EntityType {
  CHARACTER = 'CHARACTER',
  ITEM = 'ITEM',
  LOCATION = 'LOCATION',
  FACTION = 'FACTION',
  PLOT_THREAD = 'PLOT_THREAD',
  FORESHADOWING = 'FORESHADOWING'
}

export enum SceneStage {
  SCENE_PLAN = 'SCENE_PLAN'
}

export const StateChangeSchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string(),
  property: z.string(),
  previousValue: z.string().nullable(),
  newValue: z.string(),
  reason: z.string().optional()
});

export const SceneSchema = z.object({
  scenes: z.array(z.object({
    sceneNumber: z.number(),
    function: z.string(),
    povCharacter: z.string().nullable(),
    location: z.string().nullable(),
    time: z.string().nullable(),
    objective: z.string().nullable(),
    conflict: z.string().nullable(),
    obstacle: z.string().nullable(),
    escalation: z.string().nullable(),
    turningPoint: z.string().nullable(),
    outcome: z.string().nullable(),
    emotionalBeat: z.string().nullable(),
    informationControl: z.record(z.string(), z.any()).nullable(),
    plotThreads: z.record(z.string(), z.any()).nullable(),
    foreshadowing: z.record(z.string(), z.any()).nullable(),
    transitionToNext: z.string().nullable(),
    stateChanges: z.array(StateChangeSchema)
  }))
});
