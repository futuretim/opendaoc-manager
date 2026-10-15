import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCharacter, searchCharacters } from "../db/characters.js";

const listQuery = z.object({
  query: z.string().optional(),
  realm: z.coerce.number().int().min(0).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function characterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/characters", async (request) => {
    const { query, realm, page, pageSize } = listQuery.parse(request.query);
    const items = await searchCharacters({
      q: query,
      realm,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/characters/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }
    return { character };
  });
}
