import fs from 'fs';
import path from 'path';

const baseDir = path.join(process.cwd(), 'apps/api/src');
const dirs = ['plugins', 'routes', 'services', 'schemas', 'errors'];

dirs.forEach(d => {
  const dirPath = path.join(baseDir, d);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// errors/index.ts
fs.writeFileSync(path.join(baseDir, 'errors/index.ts'), `
export class ValidationError extends Error {
  constructor(public message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}
export class NotFoundError extends Error {
  constructor(public message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
`);

// plugins/database.ts
fs.writeFileSync(path.join(baseDir, 'plugins/database.ts'), `
import fp from 'fastify-plugin';
import { db } from '@ane/database';

export default fp(async (fastify) => {
  fastify.decorate('db', db);
  fastify.addHook('onClose', async () => {
    await db.$disconnect();
  });
});
`);

// plugins/redis.ts
fs.writeFileSync(path.join(baseDir, 'plugins/redis.ts'), `
import fp from 'fastify-plugin';
import Redis from 'ioredis';

export default fp(async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});
`);

// plugins/cors.ts
fs.writeFileSync(path.join(baseDir, 'plugins/cors.ts'), `
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000'
  });
});
`);

// server.ts
fs.writeFileSync(path.join(baseDir, 'server.ts'), `
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import corsPlugin from "./plugins/cors.js";
import dbPlugin from "./plugins/database.js";
import redisPlugin from "./plugins/redis.js";

import { novelRoutes } from "./routes/novels.js";
import { storyBibleRoutes } from "./routes/story-bibles.js";
import { characterRoutes } from "./routes/characters.js";
import { worldRoutes } from "./routes/world.js";
import { arcRoutes } from "./routes/arcs.js";
import { chapterRoutes } from "./routes/chapters.js";
import { plotThreadRoutes } from "./routes/plot-threads.js";
import { foreshadowingRoutes } from "./routes/foreshadowing.js";

import { NotFoundError, ValidationError } from "./errors/index.js";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

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
await app.register(redisPlugin);

app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

await app.register(novelRoutes, { prefix: '/api/novels' });
await app.register(storyBibleRoutes, { prefix: '/api/story-bibles' });
await app.register(characterRoutes, { prefix: '/api/characters' });
await app.register(worldRoutes, { prefix: '/api/world' });
await app.register(arcRoutes, { prefix: '/api/arcs' });
await app.register(chapterRoutes, { prefix: '/api/chapters' });
await app.register(plotThreadRoutes, { prefix: '/api/plot-threads' });
await app.register(foreshadowingRoutes, { prefix: '/api/foreshadowing' });

export { app };

if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  await app.listen({ host: "0.0.0.0", port: Number(process.env.API_PORT ?? 3001) });
}
`);

// schemas/novel.schema.ts
fs.writeFileSync(path.join(baseDir, 'schemas/novel.schema.ts'), `
import { z } from 'zod';
export const NovelStatusSchema = z.enum(["DRAFT", "PLANNING", "GENERATING", "PAUSED", "COMPLETED", "ARCHIVED"]);
export const CreateNovelSchema = z.object({
  title: z.string().min(1),
  premise: z.string().optional(),
  language: z.string().default("vi"),
  genre: z.string().optional(),
  tone: z.string().optional(),
  targetChapters: z.number().int().positive().optional(),
  chapterWordGoal: z.number().int().positive().optional(),
});
export const UpdateNovelSchema = CreateNovelSchema.partial().extend({
  status: NovelStatusSchema.optional()
});
`);

// services/novel.service.ts
fs.writeFileSync(path.join(baseDir, 'services/novel.service.ts'), `
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class NovelService {
  async create(data: any) {
    return db.novel.create({ data });
  }
  async findAll() {
    return db.novel.findMany({ orderBy: { updatedAt: 'desc' } });
  }
  async findById(id: string) {
    const novel = await db.novel.findUnique({ where: { id } });
    if (!novel) throw new NotFoundError('Novel not found');
    return novel;
  }
  async update(id: string, data: any) {
    await this.findById(id); // Check existence
    return db.novel.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    await db.novel.delete({ where: { id } });
  }
}
export const novelService = new NovelService();
`);

// routes/novels.ts
fs.writeFileSync(path.join(baseDir, 'routes/novels.ts'), `
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { novelService } from "../services/novel.service.js";
import { CreateNovelSchema, UpdateNovelSchema } from "../schemas/novel.schema.js";

export const novelRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/", { schema: { body: CreateNovelSchema } }, async (request, reply) => {
    const novel = await novelService.create(request.body);
    return reply.status(201).send(novel);
  });
  app.get("/", async () => novelService.findAll());
  app.get("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return novelService.findById(request.params.id);
  });
  app.patch("/:id", { schema: { params: z.object({ id: z.string() }), body: UpdateNovelSchema } }, async (request) => {
    return novelService.update(request.params.id, request.body);
  });
  app.delete("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await novelService.delete(request.params.id);
    return reply.status(204).send();
  });
};
`);

// Helper to scaffold basic CRUD routes and services
const generateBasicCrud = (name, entity, schemaContent) => {
  fs.writeFileSync(path.join(baseDir, \`schemas/\${name}.schema.ts\`), schemaContent);
  fs.writeFileSync(path.join(baseDir, \`services/\${name}.service.ts\`), \`
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class \${name.charAt(0).toUpperCase() + name.slice(1)}Service {
  async create(novelId: string, data: any) {
    return (db.\${entity} as any).create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db.\${entity} as any).findMany({ where: { novelId }, orderBy: { createdAt: 'desc' } });
  }
  async findById(id: string) {
    const item = await (db.\${entity} as any).findUnique({ where: { id } });
    if (!item) throw new NotFoundError('\${name} not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db.\${entity} as any).update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    await (db.\${entity} as any).delete({ where: { id } });
  }
}
export const \${name}Service = new \${name.charAt(0).toUpperCase() + name.slice(1)}Service();
\`);
  
  fs.writeFileSync(path.join(baseDir, \`routes/\${name}s.ts\`), \`
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { \${name}Service } from "../services/\${name}.service.js";
import { Create\${name.charAt(0).toUpperCase() + name.slice(1)}Schema } from "../schemas/\${name}.schema.js";

export const \${name}Routes: FastifyPluginAsyncZod = async (app) => {
  app.post("/novel/:novelId", { schema: { params: z.object({ novelId: z.string() }), body: Create\${name.charAt(0).toUpperCase() + name.slice(1)}Schema } }, async (request, reply) => {
    const item = await \${name}Service.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get("/novel/:novelId", { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return \${name}Service.findAll(request.params.novelId);
  });
  app.get("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return \${name}Service.findById(request.params.id);
  });
  app.patch("/:id", { schema: { params: z.object({ id: z.string() }), body: Create\${name.charAt(0).toUpperCase() + name.slice(1)}Schema.partial() } }, async (request) => {
    return \${name}Service.update(request.params.id, request.body);
  });
  app.delete("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {
    await \${name}Service.delete(request.params.id);
    return reply.status(204).send();
  });
};
\`);
};

// Character
generateBasicCrud('character', 'character', \`
import { z } from 'zod';
export const CreateCharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  description: z.string().optional(),
  motivation: z.string().optional(),
  background: z.string().optional(),
});
\`);

// StoryBible (Needs custom logic for versions)
fs.writeFileSync(path.join(baseDir, \`schemas/story-bible.schema.ts\`), \`
import { z } from 'zod';
export const CreateStoryBibleSchema = z.object({
  version: z.number().int().min(1),
  logline: z.string().optional(),
  synopsis: z.string().optional(),
});
\`);
fs.writeFileSync(path.join(baseDir, \`services/story-bible.service.ts\`), \`
import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class StoryBibleService {
  async create(novelId: string, data: any) {
    return db.storyBible.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return db.storyBible.findMany({ where: { novelId }, orderBy: { version: 'desc' } });
  }
  async findById(id: string) {
    const item = await db.storyBible.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('StoryBible not found');
    return item;
  }
}
export const storyBibleService = new StoryBibleService();
\`);
fs.writeFileSync(path.join(baseDir, \`routes/story-bibles.ts\`), \`
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { storyBibleService } from "../services/story-bible.service.js";
import { CreateStoryBibleSchema } from "../schemas/story-bible.schema.js";

export const storyBibleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/novel/:novelId", { schema: { params: z.object({ novelId: z.string() }), body: CreateStoryBibleSchema } }, async (request, reply) => {
    const item = await storyBibleService.create(request.params.novelId, request.body);
    return reply.status(201).send(item);
  });
  app.get("/novel/:novelId", { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {
    return storyBibleService.findAll(request.params.novelId);
  });
  app.get("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    return storyBibleService.findById(request.params.id);
  });
};
\`);


generateBasicCrud('arc', 'arc', \`
import { z } from 'zod';
export const CreateArcSchema = z.object({
  number: z.number().int(),
  title: z.string().min(1),
  summary: z.string().optional(),
});
\`);

generateBasicCrud('chapter', 'chapter', \`
import { z } from 'zod';
export const CreateChapterSchema = z.object({
  number: z.number().int(),
  title: z.string().optional(),
  content: z.string().optional(),
});
\`);

generateBasicCrud('plotThread', 'plotThread', \`
import { z } from 'zod';
export const CreatePlotThreadSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});
\`);

generateBasicCrud('foreshadowing', 'foreshadowing', \`
import { z } from 'zod';
export const CreateForeshadowingSchema = z.object({
  description: z.string().min(1),
});
\`);

// World routes (combining Location, Item, Faction)
fs.writeFileSync(path.join(baseDir, \`routes/world.ts\`), \`
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
export const worldRoutes: FastifyPluginAsyncZod = async (app) => {
  // World routes can be implemented here...
  app.get("/", async () => []);
};
\`);

console.log("API Scaffolding complete!");
