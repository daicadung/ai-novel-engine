import { SceneSchema } from '@ane/core';
import { SceneContextBuilder } from './context.js';
export class SceneStageHandler {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async prepareInput(novelId, chapterId, previousSnapshotId) {
        const context = await SceneContextBuilder.buildContext(novelId, chapterId, previousSnapshotId);
        return `Generate SCENE_PLAN based on the following context:\n${context}`;
    }
    async invoke(contextPrompt, config) {
        const messages = [{ role: "user", content: contextPrompt }];
        return await this.provider.generateStructured(messages, SceneSchema, config);
    }
    async applyCanonicalPersistence(chapterId, data, tx, newVersion) {
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
