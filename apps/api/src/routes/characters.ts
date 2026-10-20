import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp } from "../auth/guards.js";
import {
  characterExists,
  getCharacter,
  searchCharacters,
  updateCharacter,
  type UpdatableCharacterField,
} from "../db/characters.js";

const listQuery = z.object({
  query: z.string().optional(),
  realm: z.coerce.number().int().min(0).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// DAoC progression ceilings. Level caps at 50; realm level is the 0-based
// RealmLevel column (RR1L0 == 0 … RR13L0 == 120). Points are unsigned ints.
const MAX_POINTS = 2_000_000_000;
const patchBody = z
  .object({
    level: z.number().int().min(1).max(50).optional(),
    realmLevel: z.number().int().min(0).max(120).optional(),
    realmPoints: z.number().int().min(0).max(MAX_POINTS).optional(),
    bountyPoints: z.number().int().min(0).max(MAX_POINTS).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

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

  app.patch("/characters/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }

    if (!(await characterExists(name))) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }

    await updateCharacter(name, parsed.data as Partial<Record<UpdatableCharacterField, unknown>>);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "character.update",
      target: `character:${name}`,
      metadata: parsed.data,
      ip: clientIp(request),
    });

    const character = await getCharacter(name);
    return { character };
  });
}
