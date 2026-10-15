import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMob, searchMobs } from "../db/mobs.js";
import { getNpcTemplate, searchNpcTemplates } from "../db/npcTemplates.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function npcRoutes(app: FastifyInstance): Promise<void> {
  app.get("/mobs", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchMobs({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.get("/mobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mob = await getMob(id);
    if (!mob) {
      return reply.code(404).send({ error: { code: "not_found", message: "Mob not found." } });
    }
    return { mob };
  });

  app.get("/npc-templates", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchNpcTemplates({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/npc-templates/:templateId", async (request, reply) => {
    const templateId = Number((request.params as { templateId: string }).templateId);
    if (!Number.isInteger(templateId)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid template id." } });
    }
    const template = await getNpcTemplate(templateId);
    if (!template) {
      return reply.code(404).send({ error: { code: "not_found", message: "NPC template not found." } });
    }
    return { template };
  });
}
