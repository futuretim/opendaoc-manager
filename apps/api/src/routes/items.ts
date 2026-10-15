import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getItem, searchItems } from "../db/items.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/items", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchItems({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/items/:idNb", async (request, reply) => {
    const { idNb } = request.params as { idNb: string };
    const item = await getItem(idNb);
    if (!item) {
      return reply.code(404).send({ error: { code: "not_found", message: "Item not found." } });
    }
    return { item };
  });
}
