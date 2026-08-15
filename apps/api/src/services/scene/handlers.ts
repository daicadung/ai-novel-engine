import { z } from 'zod';
import { SceneStage, SceneSchema, EntityType } from '@ane/core';
import { LLMProvider } from '../architect/llm.js';
import { SceneContextBuilder } from './context.js';

export class SceneStageHandler {
  protected provider: LLMProvider;
  
  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async prepareInput(novelId: string, chapterId: string, previousSnapshotId?: string): Promise<string> {
    const context = await SceneContextBuilder.buildContext(novelId, chapterId, previousSnapshotId);
    return `Generate SCENE_PLAN based on the following context:\n${context}`;
  }
  
  async invoke(contextPrompt: string, config?: any) {
    const messages = [{ role: "user" as const, content: contextPrompt }];
    return await this.provider.generateStructured(messages, SceneSchema, config);
  }

  async applyCanonicalPersistence(
    chapterId: string, 
    data: z.infer<typeof SceneSchema>, 
    tx: any, 
    newVersion: number
  ): Promise<string> {
    const version = await tx.scenePlanVersion.create({
      data: {
        chapterId,
        version: newVersion,
        status: 'CANONICAL'
      }
    });

    for (const scene of data.scenes) {
      await tx.scene.create({
        data: {
          scenePlanVersionId: version.id,
          sceneNumber: scene.sceneNumber,
          status: 'CANONICAL',
          function: scene.function,
          povCharacter: scene.povCharacter,
          location: scene.location,
          time: scene.time,
          objective: scene.objective,
          conflict: scene.conflict,
          obstacle: scene.obstacle,
          escalation: scene.escalation,
          turningPoint: scene.turningPoint,
          outcome: scene.outcome,
          emotionalBeat: scene.emotionalBeat,
          informationControl: scene.informationControl || {},
          plotThreads: scene.plotThreads || {},
          foreshadowing: scene.foreshadowing || {},
          transitionToNext: scene.transitionToNext,
          stateChanges: {
            create: scene.stateChanges.map(change => ({
              entityType: change.entityType,
              entityId: change.entityId,
              property: change.property,
              previousValue: change.previousValue,
              newValue: change.newValue,
              reason: change.reason
            }))
          }
        }
      });
    }

    return version.id;
  }
}
