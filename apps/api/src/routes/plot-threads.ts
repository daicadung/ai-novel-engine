import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { plotThreadService } from '../services/plot-thread.service.js';
import { CreatePlotThreadSchema, UpdatePlotThreadSchema } from '../schemas/plot-thread.schema.js';

export const plotThreadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreatePlotThreadSchema } }, async (request, reply) => {
    const item = await plotThreadService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return plotThreadService.findAll(request.params.novelId);
  });
  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return plotThreadService.findById(request.params.id);
  });
  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdatePlotThreadSchema } }, async (request) => {
    return plotThreadService.update(request.params.id, request.body);
  });
  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await plotThreadService.delete(request.params.id);
    return reply.status(204).send();
  });
};
