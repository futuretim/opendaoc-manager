import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getQuest, searchQuests } from "../db/quests.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function questRoutes(app: FastifyInstance): Promise<void> {
  app.get("/quests", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchQuests({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/quests/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid quest id." } });
    }
    const quest = await getQuest(id);
    if (!quest) {
      return reply.code(404).send({ error: { code: "not_found", message: "Quest not found." } });
    }
    return { quest };
  });
}
