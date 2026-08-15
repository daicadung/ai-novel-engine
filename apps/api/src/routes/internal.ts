import { FastifyPluginAsync } from 'fastify';
import { ServerlessJobProcessor, ProcessorResult } from '../services/queue/ServerlessJobProcessor.js';
import { timingSafeEqual } from 'node:crypto';

export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/jobs/process', async (request, reply) => {
    // --- SECURITY: Validate INTERNAL_JOB_SECRET ---
    const internalSecret = process.env.INTERNAL_JOB_SECRET;

    if (!internalSecret) {
      // If secret is not configured, always deny — never allow an open endpoint
      return reply.code(503).send({ error: 'Internal job processing is not configured.' });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const providedToken = authHeader.slice('Bearer '.length);

    // Use timing-safe comparison to prevent timing attacks
    let isValid = false;
    try {
      const secretBuf = Buffer.from(internalSecret, 'utf8');
      const providedBuf = Buffer.from(providedToken, 'utf8');
      // timingSafeEqual requires same-length buffers
      if (secretBuf.length === providedBuf.length) {
        isValid = timingSafeEqual(secretBuf, providedBuf);
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // --- EXECUTE: Process next batch of jobs ---
    try {
      const processor = new ServerlessJobProcessor();
      const result: ProcessorResult = await processor.processNextBatch();

      return reply.send({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        retryPending: result.retryPending,
        recovered: result.recovered,
      });
    } catch (err: any) {
      // Log without exposing secrets or sensitive context
      fastify.log.error({ msg: 'Job processor error', error: err.message });
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
};
