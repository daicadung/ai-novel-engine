const fs = require('fs');
const path = require('path');

const models = [
  { name: 'StoryBible', camel: 'storyBible', kebab: 'story-bibles', fields: '{ version: z.number().int().min(1), logline: z.string().optional() }' },
  { name: 'Character', camel: 'character', kebab: 'characters', fields: '{ name: z.string().min(1), role: z.string().optional() }' },
  { name: 'Location', camel: 'location', kebab: 'locations', fields: '{ name: z.string().min(1), region: z.string().optional() }' },
  { name: 'Item', camel: 'item', kebab: 'items', fields: '{ name: z.string().min(1), description: z.string().optional() }' },
  { name: 'Faction', camel: 'faction', kebab: 'factions', fields: '{ name: z.string().min(1), goals: z.string().optional() }' },
  { name: 'Relationship', camel: 'relationship', kebab: 'relationships', fields: '{ sourceId: z.string(), sourceType: z.string(), targetId: z.string(), targetType: z.string() }' },
  { name: 'Event', camel: 'event', kebab: 'events', fields: '{ title: z.string().min(1), chronologicalOrder: z.number().int().optional() }' },
  { name: 'Arc', camel: 'arc', kebab: 'arcs', fields: '{ title: z.string().min(1), number: z.number().int() }' },
  { name: 'Chapter', camel: 'chapter', kebab: 'chapters', fields: '{ number: z.number().int(), title: z.string().optional() }' },
  { name: 'PlotThread', camel: 'plotThread', kebab: 'plot-threads', fields: '{ title: z.string().min(1), description: z.string() }' },
  { name: 'Foreshadowing', camel: 'foreshadowing', kebab: 'foreshadowing', fields: '{ description: z.string().min(1) }' },
  { name: 'Memory', camel: 'memory', kebab: 'memories', fields: '{ category: z.string(), title: z.string(), content: z.string() }' }
];

const baseDir = path.join(process.cwd(), 'apps/api/src');

for (const m of models) {
  // Schema
  fs.writeFileSync(path.join(baseDir, 'schemas', m.kebab.replace('s', '') + '.schema.ts'), 
  "import { z } from 'zod';\n" +
  "export const Create" + m.name + "Schema = z.object(" + m.fields + ");\n" +
  "export const Update" + m.name + "Schema = Create" + m.name + "Schema.partial();\n");

  // Service
  fs.writeFileSync(path.join(baseDir, 'services', m.kebab.replace('s', '') + '.service.ts'),
  "import { db } from '@ane/database';\n" +
  "import { NotFoundError } from '../errors/index.js';\n\n" +
  "export class " + m.name + "Service {\n" +
  "  async create(novelId: string, data: any) {\n" +
  "    return (db as any)." + m.camel + ".create({ data: { ...data, novelId } });\n" +
  "  }\n" +
  "  async findAll(novelId: string) {\n" +
  "    return (db as any)." + m.camel + ".findMany({ where: { novelId } });\n" +
  "  }\n" +
  "  async findById(id: string) {\n" +
  "    const item = await (db as any)." + m.camel + ".findUnique({ where: { id } });\n" +
  "    if (!item) throw new NotFoundError('" + m.name + " not found');\n" +
  "    return item;\n" +
  "  }\n" +
  "  async update(id: string, data: any) {\n" +
  "    await this.findById(id);\n" +
  "    return (db as any)." + m.camel + ".update({ where: { id }, data });\n" +
  "  }\n" +
  "  async delete(id: string) {\n" +
  "    await this.findById(id);\n" +
  "    return (db as any)." + m.camel + ".delete({ where: { id } });\n" +
  "  }\n" +
  "}\n" +
  "export const " + m.camel + "Service = new " + m.name + "Service();\n");

  // Route
  fs.writeFileSync(path.join(baseDir, 'routes', m.kebab + '.ts'),
  "import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';\n" +
  "import { z } from 'zod';\n" +
  "import { " + m.camel + "Service } from '../services/" + m.kebab.replace('s', '') + ".service.js';\n" +
  "import { Create" + m.name + "Schema, Update" + m.name + "Schema } from '../schemas/" + m.kebab.replace('s', '') + ".schema.js';\n\n" +
  "export const " + m.camel + "Routes: FastifyPluginAsyncZod = async (app) => {\n" +
  "  app.post('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }), body: Create" + m.name + "Schema } }, async (request, reply) => {\n" +
  "    const item = await " + m.camel + "Service.create(request.params.novelId, request.body);\n" +
  "    return reply.status(201).send(item);\n" +
  "  });\n" +
  "  app.get('/novel/:novelId', { schema: { params: z.object({ novelId: z.string() }) } }, async (request) => {\n" +
  "    return " + m.camel + "Service.findAll(request.params.novelId);\n" +
  "  });\n" +
  "  app.get('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request) => {\n" +
  "    return " + m.camel + "Service.findById(request.params.id);\n" +
  "  });\n" +
  "  app.patch('/:id', { schema: { params: z.object({ id: z.string() }), body: Update" + m.name + "Schema } }, async (request) => {\n" +
  "    return " + m.camel + "Service.update(request.params.id, request.body);\n" +
  "  });\n" +
  "  app.delete('/:id', { schema: { params: z.object({ id: z.string() }) } }, async (request, reply) => {\n" +
  "    await " + m.camel + "Service.delete(request.params.id);\n" +
  "    return reply.status(204).send();\n" +
  "  });\n" +
  "};\n");
}
console.log("Sub-resource APIs generated successfully.");
