import { z } from 'zod';
import { relationshipService } from '../services/relationhips.service.js';
import { CreateRelationshipSchema, UpdateRelationshipSchema } from '../schemas/relationhips.schema.js';
export const relationshipRoutes = async (app) => {
    app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateRelationshipSchema } }, async (request, reply) => {
        const item = await relationshipService.create(request.params.novelId, request.body);
        return reply.status(201).send(item);
    });
    app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
        return relationshipService.findAll(request.params.novelId);
    });
    app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
        return relationshipService.findById(request.params.id);
    });
    app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateRelationshipSchema } }, async (request) => {
        return relationshipService.update(request.params.id, request.body);
    });
    app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
        await relationshipService.delete(request.params.id);
        return reply.status(204).send();
    });
};
