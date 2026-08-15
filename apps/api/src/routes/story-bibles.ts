import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { storyBibleService } from '../services/tory-bibles.service.js';
import { CreateStoryBibleSchema, UpdateStoryBibleSchema } from '../schemas/tory-bibles.schema.js';

export const storyBibleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateStoryBibleSchema } }, async (request, reply) => {
    const item = await storyBibleService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return storyBibleService.findAll(request.params.novelId);
  });
  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return storyBibleService.findById(request.params.id);
  });
  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateStoryBibleSchema } }, async (request) => {
    return storyBibleService.update(request.params.id, request.body);
  });
  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await storyBibleService.delete(request.params.id);
    return reply.status(204).send();
  });
};
