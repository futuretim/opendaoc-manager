import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSpell, searchSpells } from "../db/spells.js";
import { getStyle, searchStyles } from "../db/styles.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function abilityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/spells", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchSpells({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.get("/spells/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid spell id." } });
    }
    const spell = await getSpell(id);
    if (!spell) {
      return reply.code(404).send({ error: { code: "not_found", message: "Spell not found." } });
    }
    return { spell };
  });

  app.get("/styles", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await searchStyles({ q: query, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.get("/styles/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid style id." } });
    }
    const style = await getStyle(id);
    if (!style) {
      return reply.code(404).send({ error: { code: "not_found", message: "Style not found." } });
    }
    return { style };
  });
}
