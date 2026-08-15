import { z } from 'zod';
import { characterService } from '../services/character.service.js';
import { CreateCharacterSchema, UpdateCharacterSchema } from '../schemas/character.schema.js';
export const characterRoutes = async (app) => {
    app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: CreateCharacterSchema } }, async (request, reply) => {
        const item = await characterService.create(request.params.novelId, request.body);
        return reply.status(201).send(item);
    });
    app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
        return characterService.findAll(request.params.novelId);
    });
    app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
        return characterService.findById(request.params.id);
    });
    app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: UpdateCharacterSchema } }, async (request) => {
        return characterService.update(request.params.id, request.body);
    });
    app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
        await characterService.delete(request.params.id);
        return reply.status(204).send();
    });
};
