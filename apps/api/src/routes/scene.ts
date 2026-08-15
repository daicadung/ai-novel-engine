import { FastifyInstance } from 'fastify';
import { SceneManager } from '../services/scene/manager.js';
import { MockProvider } from '../services/architect/llm.js';
import { db } from '@ane/database';

export default async function sceneRoutes(fastify: FastifyInstance) {
  const manager = new SceneManager();

  fastify.post('/:novelId/chapters/:chapterId/scenes/generate', async (request, reply) => {
    const { novelId, chapterId } = request.params as { novelId: string, chapterId: string };
    const { previousSnapshotId } = request.body as { previousSnapshotId?: string } || {};
    
    manager.runStage(novelId, chapterId, previousSnapshotId).catch(console.error);
    return reply.status(202).send({ message: 'Generation started' });
  });

  fastify.get('/:novelId/chapters/:chapterId/scenes', async (request, reply) => {
    const { chapterId } = request.params as { novelId: string, chapterId: string };
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
    const { novelId, chapterNumber } = request.params as { novelId: string, chapterNumber: string };
    const snapshot = await db.continuitySnapshot.findFirst({
      where: { novelId, chapterNumber: parseInt(chapterNumber), status: 'CANONICAL' },
      orderBy: { createdAt: 'desc' }
    });
    return snapshot || { message: 'No canonical snapshot found' };
  });
}
