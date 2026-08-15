import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eventService } from '../services/event.service.js';
import { CreateEventSchema, UpdateEventSchema } from '../schemas/event.schema.js';

export const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateEventSchema } }, async (request, reply) => {
    const item = await eventService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return eventService.findAll(request.params.novelId);
  });
  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return eventService.findById(request.params.id);
  });
  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateEventSchema } }, async (request) => {
    return eventService.update(request.params.id, request.body);
  });
  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await eventService.delete(request.params.id);
    return reply.status(204).send();
  });
};
