import { JobType } from '@ane/core';
import { QueueFactory } from '../services/queue/index.js';
import { db } from '@ane/database';
export default async function proseRoutes(fastify) {
    const queueManager = QueueFactory.getQueueManager();
    fastify.post('/:novelId/chapters/:chapterId/prose/generate', async (request, reply) => {
        const { novelId, chapterId } = request.params;
        const { scenePlanVersionId, previousSnapshotId } = request.body;
        const job = await queueManager.addJob(JobType.PROSE_GENERATION, { novelId, chapterId, scenePlanVersionId, previousSnapshotId });
        return reply.status(202).send({ jobId: job.id, status: job.status, correlationId: job.id, message: 'Generation started' });
    });
    fastify.get('/:novelId/chapters/:chapterId/prose', async (request, reply) => {
        const { chapterId } = request.params;
        const chapterProse = await db.chapterProse.findUnique({
            where: { chapterId },
            include: {
                versions: {
                    where: { status: 'CANONICAL' },
                    include: { sceneProseList: { orderBy: { createdAt: 'asc' } } }
                }
            }
        });
        return chapterProse || { message: 'No canonical prose found' };
    });
    fastify.get('/:novelId/chapters/:chapterId/prose/versions', async (request, reply) => {
        const { chapterId } = request.params;
        const chapterProse = await db.chapterProse.findUnique({
            where: { chapterId },
            include: { versions: { orderBy: { generatedAt: 'desc' } } }
        });
        return chapterProse || { message: 'No prose found' };
    });
}
