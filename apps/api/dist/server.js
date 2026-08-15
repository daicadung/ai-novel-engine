import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import corsPlugin from "./plugins/cors.js";
import dbPlugin from "./plugins/database.js";
import { novelRoutes } from "./routes/novels.js";
import { storyBibleRoutes } from "./routes/story-bibles.js";
import { characterRoutes } from "./routes/characters.js";
import { locationRoutes } from "./routes/locations.js";
import { factionRoutes } from "./routes/factions.js";
import { itemRoutes } from "./routes/items.js";
import { relationshipRoutes } from "./routes/relationships.js";
import { eventRoutes } from "./routes/events.js";
import { arcRoutes } from "./routes/arcs.js";
import { chapterRoutes } from "./routes/chapters.js";
import { plotThreadRoutes } from "./routes/plot-threads.js";
import { foreshadowingRoutes } from "./routes/foreshadowing.js";
import { architectRoutes } from "./routes/architect.js";
import plannerRoutes from './routes/planner.js';
import sceneRoutes from './routes/scene.js';
import proseRoutes from './routes/prose.js';
import { internalRoutes } from './routes/internal.js';
import { generationRoutes } from './routes/generation.js';
import { qualityRoutes } from './routes/quality.js';
import { planningRoutes } from './routes/planning.js';
import { NotFoundError, ValidationError } from "./errors/index.js";
const app = Fastify({ logger: true }).withTypeProvider();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: error.message, details: error.details } });
    }
    if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error.validation) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.validation } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
});
await app.register(corsPlugin);
await app.register(dbPlugin);
app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
});
await app.register(novelRoutes, { prefix: '/api/novels' });
await app.register(storyBibleRoutes, { prefix: '/api/story-bibles' });
await app.register(characterRoutes, { prefix: '/api/characters' });
await app.register(locationRoutes, { prefix: '/api/locations' });
await app.register(factionRoutes, { prefix: '/api/factions' });
await app.register(itemRoutes, { prefix: '/api/items' });
await app.register(relationshipRoutes, { prefix: '/api/relationships' });
await app.register(eventRoutes, { prefix: '/api/events' });
await app.register(arcRoutes, { prefix: '/api/arcs' });
await app.register(chapterRoutes, { prefix: '/api/chapters' });
await app.register(plotThreadRoutes, { prefix: '/api/plot-threads' });
await app.register(foreshadowingRoutes, { prefix: '/api/foreshadowing' });
await app.register(architectRoutes, { prefix: '/api/architect' });
await app.register(plannerRoutes, { prefix: '/api/planner' });
await app.register(sceneRoutes, { prefix: '/api/scene' });
await app.register(proseRoutes, { prefix: '/api/prose' });
await app.register(internalRoutes, { prefix: '/api/internal' });
await app.register(generationRoutes, { prefix: '/api' });
await app.register(qualityRoutes, { prefix: '/api' });
await app.register(planningRoutes, { prefix: '/api' });
export { app };
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
    await app.listen({ host: "0.0.0.0", port: Number(process.env.API_PORT ?? 3001) });
}
