import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { locationService } from '../services/location.service.js';
import { CreateLocationSchema, UpdateLocationSchema } from '../schemas/location.schema.js';

export const locationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateLocationSchema } }, async (request, reply) => {
    const item = await locationService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return locationService.findAll(request.params.novelId);
  });
  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return locationService.findById(request.params.id);
  });
  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateLocationSchema } }, async (request) => {
    return locationService.update(request.params.id, request.body);
  });
  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await locationService.delete(request.params.id);
    return reply.status(204).send();
  });
};
