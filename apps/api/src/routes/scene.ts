import { FastifyInstance } from 'fastify';
import { JobType } from '@ane/core';
import { db } from '@ane/database';
import { QueueFactory } from '../services/queue/index.js';

export default async function sceneRoutes(fastify: FastifyInstance) {
  const queueManager = QueueFactory.getQueueManager();

  fastify.post('/:novelId/chapters/:chapterId/scenes/generate', async (request, reply) => {
    const { novelId, chapterId } = request.params as { novelId: string, chapterId: string };
    
    const job = await queueManager.addJob(JobType.SCENE_GENERATION, { novelId, chapterId });
    return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation queued' });
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
