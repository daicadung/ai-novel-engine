import fs from 'fs';
import path from 'path';

const models = [
  { name: 'character', modelName: 'character' },
  { name: 'location', modelName: 'location' },
  { name: 'faction', modelName: 'faction' },
  { name: 'item', modelName: 'item' },
  { name: 'relationship', modelName: 'relationship' },
  { name: 'event', modelName: 'event' },
  { name: 'storyBible', modelName: 'storyBible' },
  { name: 'arc', modelName: 'arc' }
];

const template = (name, modelName) => `import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "@ane/database";

export const ${name}Routes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", async (request, reply) => {
    return db.${modelName}.findMany();
  });

  app.get("/:id", {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    const item = await db.${modelName}.findUnique({ where: { id: request.params.id } });
    if (!item) return reply.status(404).send({ error: "Not found" });
    return item;
  });

  app.delete("/:id", {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request, reply) => {
    await db.${modelName}.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
};
`;

const dir = path.join(process.cwd(), 'apps/api/src/routes');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

for (const model of models) {
  const code = template(model.name, model.modelName);
  fs.writeFileSync(path.join(dir, model.name + 's.ts'), code);
}
console.log("Routes generated!");
