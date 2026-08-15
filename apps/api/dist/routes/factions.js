import { z } from 'zod';
import { factionService } from '../services/faction.service.js';
import { CreateFactionSchema, UpdateFactionSchema } from '../schemas/faction.schema.js';
export const factionRoutes = async (app) => {
    app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateFactionSchema } }, async (request, reply) => {
        const item = await factionService.create(request.params.novelId, request.body);
        return reply.status(201).send(item);
    });
    app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
        return factionService.findAll(request.params.novelId);
    });
    app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
        return factionService.findById(request.params.id);
    });
    app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateFactionSchema } }, async (request) => {
        return factionService.update(request.params.id, request.body);
    });
    app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
        await factionService.delete(request.params.id);
        return reply.status(204).send();
    });
};
