import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getLootTemplate, listLootTemplates } from "../db/loot.js";
import { getMerchantList, listMerchantLists } from "../db/merchants.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function economyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/loot-templates", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await listLootTemplates({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/loot-templates/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const template = await getLootTemplate(name);
    if (!template) {
      return reply.code(404).send({ error: { code: "not_found", message: "Loot template not found." } });
    }
    return { template };
  });

  app.get("/merchant-lists", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await listMerchantLists({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/merchant-lists/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const list = await getMerchantList(id);
    if (!list) {
      return reply.code(404).send({ error: { code: "not_found", message: "Merchant list not found." } });
    }
    return { list };
  });
}
