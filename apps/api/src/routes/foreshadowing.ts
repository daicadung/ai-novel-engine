import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { foreshadowingService } from '../services/forehadowing.service.js';
import { CreateForeshadowingSchema, UpdateForeshadowingSchema } from '../schemas/forehadowing.schema.js';

export const foreshadowingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateForeshadowingSchema } }, async (request, reply) => {
    const item = await foreshadowingService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return foreshadowingService.findAll(request.params.novelId);
  });
  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return foreshadowingService.findById(request.params.id);
  });
  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateForeshadowingSchema } }, async (request) => {
    return foreshadowingService.update(request.params.id, request.body);
  });
  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await foreshadowingService.delete(request.params.id);
    return reply.status(204).send();
  });
};
