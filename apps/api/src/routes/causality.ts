import { FastifyPluginAsync } from 'fastify';
import { db } from '@ane/database';
import { CausalGraph } from '../services/causality/CausalGraph.js';
import { CausalImpactAnalyzer } from '../services/causality/CausalImpactAnalyzer.js';
import { DatabaseQueueManager } from '../services/queue/DatabaseQueueManager.js';
import { JobType } from '@ane/core';

export const causalityRoutes: FastifyPluginAsync = async (server) => {
  server.get('/novels/:id/generation/causality', async (request, reply) => {
    const { id } = request.params as { id: string };
    const analysis = await db.causalAnalysisRecord.findMany({
      where: { novelId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return analysis;
  });

  server.get('/novels/:id/generation/causality/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const events = await db.causalEventRecord.findMany({
      where: { 
        novelId: id,
        ...(query.importance ? { importance: query.importance } : {}),
        ...(query.chapterNumber ? { chapterNumber: parseInt(query.chapterNumber) } : {})
      },
      orderBy: { chapterNumber: 'desc' },
      take: parseInt(query.limit) || 100,
    });
    return events;
  });

  server.get('/novels/:id/generation/causality/consequences', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const consequences = await db.consequenceRecord.findMany({
      where: { 
        novelId: id,
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(query.limit) || 100,
    });
    return consequences;
  });

  server.get('/novels/:id/generation/causality/dependencies', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const deps = await db.causalDependencyRecord.findMany({
      where: { 
        novelId: id,
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(query.limit) || 100,
    });
    return deps;
  });

  server.get('/novels/:id/generation/causality/graph', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { startEventId?: string; depth?: string };
    if (!query.startEventId) {
      return reply.code(400).send({ error: 'startEventId is required' });
    }
    const maxDepth = query.depth ? parseInt(query.depth) : 5;
    
    const graph = await CausalGraph.traverseDownstream(id, query.startEventId, {
      maxDepth,
      maxNodes: 100,
      maxEdges: 200,
    });
    return graph;
  });

  server.get('/novels/:id/generation/causality/impact/:eventId', async (request, reply) => {
    const { id, eventId } = request.params as { id: string, eventId: string };
    const impact = await CausalImpactAnalyzer.analyzeImpact(id, eventId);
    return impact;
  });

  server.get('/novels/:id/generation/causality/health', async (request, reply) => {
    const { id } = request.params as { id: string };
    const health = await db.causalHealthScoreRecord.findFirst({
      where: { novelId: id },
      orderBy: { createdAt: 'desc' }
    });
    return health || { status: 'NO_DATA' };
  });

  server.post('/novels/:id/generation/causality/analyze', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { chapterId: string; chapterNumber: number };
    
    const queueManager = new DatabaseQueueManager();
    const job = await queueManager.addJob(JobType.CAUSALITY_ANALYSIS, {
      novelId: id,
      chapterId: body.chapterId,
      chapterNumber: body.chapterNumber,
    });
    
    return { status: 'QUEUED', jobId: job.id };
  });
};
