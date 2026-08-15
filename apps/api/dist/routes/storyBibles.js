import { z } from "zod";
import { db } from "@ane/database";
export const storyBibleRoutes = async (app) => {
    app.get("/", async (request, reply) => {
        return db.storyBible.findMany();
    });
    app.get("/:id", {
        schema: { params: z.object({ id: z.string() }) }
    }, async (request, reply) => {
        const item = await db.storyBible.findUnique({ where: { id: request.params.id } });
        if (!item)
            return reply.status(404).send({ error: "Not found" });
        return item;
    });
    app.delete("/:id", {
        schema: { params: z.object({ id: z.string() }) }
    }, async (request, reply) => {
        await db.storyBible.delete({ where: { id: request.params.id } });
        return reply.status(204).send();
    });
};
