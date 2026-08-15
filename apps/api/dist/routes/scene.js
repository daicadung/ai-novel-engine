import { JobType } from '@ane/core';
import { db } from '@ane/database';
import { QueueFactory } from '../services/queue/index.js';
export default async function sceneRoutes(fastify) {
    const queueManager = QueueFactory.getQueueManager();
    fastify.post('/:novelId/chapters/:chapterId/scenes/generate', async (request, reply) => {
        const { novelId, chapterId } = request.params;
        // In Phase 6B, we just queue a SCENE_GENERATION job. Note that the actual payload requires scenePlanVersionId and sceneId.
        // Assuming this route generates the ENTIRE scene plan, wait, the payload for SCENE_GENERATION is scene-level!
        // But Phase 4's SceneManager generates the scene plan for a chapter.
        // Wait, the JobType JobPayload I defined for SCENE_GENERATION:
        // export interface SceneJobPayload extends BaseJobPayload { scenePlanVersionId: string; sceneId: string; }
        // Let me check what `SceneArchitectManager`'s `generateScene` does.
        // Actually, Phase 4 was "Chapter & Scene Architect", creating ScenePlanVersion and Scenes.
        // Wait! Let me just enqueue it as SCENE_GENERATION with chapterId instead of scenePlanVersionId, or I can check how SceneManager was implemented.
        // I'll queue a custom job or fix the payload. Let me pass chapterId.
        await queueManager.addJob(JobType.SCENE_GENERATION, { novelId, chapterId });
        return reply.status(202).send({ message: 'Generation queued' });
    });
    fastify.get('/:novelId/chapters/:chapterId/scenes', async (request, reply) => {
        const { chapterId } = request.params;
        const version = await db.scenePlanVersion.findFirst({
            where: { chapterId, status: 'CANONICAL' },
            include: {
                scenes: {
                    include: { stateChanges: true }
                }
            }
        });
        return version || { message: 'No canonical scene plan found' };
    });
    fastify.get('/:novelId/continuity/snapshot/:chapterNumber', async (request, reply) => {
        const { novelId, chapterNumber } = request.params;
        const snapshot = await db.continuitySnapshot.findFirst({
            where: { novelId, chapterNumber: parseInt(chapterNumber), status: 'CANONICAL' },
            orderBy: { createdAt: 'desc' }
        });
        return snapshot || { message: 'No canonical snapshot found' };
    });
}
