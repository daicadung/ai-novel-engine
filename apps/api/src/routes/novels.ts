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
