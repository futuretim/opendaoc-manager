import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import { getAccount } from "../db/accounts.js";
import {
  characterExists,
  getCharacter,
  moveCharacter,
  renameCharacter,
  searchCharacters,
  updateCharacter,
  type UpdatableCharacterField,
} from "../db/characters.js";

// DAoC character names are letters only, 2-24 chars.
const characterNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(24, "Name must be at most 24 characters")
  .regex(/^[A-Za-z]+$/, "Name may contain letters only");

const renameBody = z.object({ newName: characterNameSchema });
const moveBody = z.object({ toAccount: z.string().trim().min(1, "A destination account is required") });

const listQuery = z.object({
  query: z.string().optional(),
  realm: z.coerce.number().int().min(0).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// DAoC progression + stat ceilings. Level caps at 50; realm level is the
// 0-based RealmLevel column (RR1L0 == 0 ... RR13L0 == 120). Points are
// unsigned ints. Stats are small ints (0-255 practical, but column allows
// full int range). Money columns are int (copper/silver/gold/platinum/mithril).
const MAX_POINTS = 2_000_000_000;
const MAX_STAT = 1_000_000;
const MAX_MONEY = 2_000_000_000;
const MAX_VITAL = 100_000;

const patchBody = z
  .object({
    level: z.number().int().min(1).max(50).optional(),
    realmLevel: z.number().int().min(0).max(120).optional(),
    realmPoints: z.number().int().min(0).max(MAX_POINTS).optional(),
    bountyPoints: z.number().int().min(0).max(MAX_POINTS).optional(),
    strength: z.number().int().min(0).max(MAX_STAT).optional(),
    dexterity: z.number().int().min(0).max(MAX_STAT).optional(),
    constitution: z.number().int().min(0).max(MAX_STAT).optional(),
    quickness: z.number().int().min(0).max(MAX_STAT).optional(),
    intelligence: z.number().int().min(0).max(MAX_STAT).optional(),
    piety: z.number().int().min(0).max(MAX_STAT).optional(),
    empathy: z.number().int().min(0).max(MAX_STAT).optional(),
    charisma: z.number().int().min(0).max(MAX_STAT).optional(),
    health: z.number().int().min(0).max(MAX_VITAL).optional(),
    mana: z.number().int().min(0).max(MAX_VITAL).optional(),
    endurance: z.number().int().min(0).max(MAX_VITAL).optional(),
    copper: z.number().int().min(0).max(MAX_MONEY).optional(),
    silver: z.number().int().min(0).max(MAX_MONEY).optional(),
    gold: z.number().int().min(0).max(MAX_MONEY).optional(),
    platinum: z.number().int().min(0).max(MAX_MONEY).optional(),
    mithril: z.number().int().min(0).max(MAX_MONEY).optional(),
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

  // Rename a character. Admin-only. Only DOLCharacters.Name changes; names are
  // globally unique, so a name already in use is rejected.
  app.post("/characters/:name/rename", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = renameBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid name." } });
    }
    const newName = parsed.data.newName;

    if (!(await characterExists(name))) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }
    if (newName.toLowerCase() === name.toLowerCase()) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: "The new name matches the current name." } });
    }
    if (await characterExists(newName)) {
      return reply
        .code(409)
        .send({ error: { code: "conflict", message: `A character named "${newName}" already exists.` } });
    }

    await renameCharacter(name, newName);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "character.rename",
      target: `character:${name}`,
      metadata: { from: name, to: newName },
      ip: clientIp(request),
    });

    const character = await getCharacter(newName);
    return { character };
  });

  // Move a character to another account. Admin-only. The character keeps its
  // realm and takes the first free slot of that realm on the destination.
  app.post("/characters/:name/move", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = moveBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }
    const toAccount = parsed.data.toAccount;

    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }
    // Resolve the destination's canonical name so the stored AccountName matches
    // the account row exactly, regardless of the casing the admin typed.
    const destAccount = await getAccount(toAccount);
    if (!destAccount) {
      return reply
        .code(404)
        .send({ error: { code: "not_found", message: `Destination account "${toAccount}" not found.` } });
    }
    if (destAccount.name.toLowerCase() === character.accountName.toLowerCase()) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: "The character is already on that account." } });
    }

    const result = await moveCharacter(name, destAccount.name, character.realm);
    if (result.status === "invalid_realm") {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "Only Albion, Midgard, and Hibernia characters can be moved.",
        },
      });
    }
    if (result.status === "no_free_slot") {
      return reply.code(409).send({
        error: {
          code: "conflict",
          message: `"${toAccount}" has no free character slot for this realm (max 8).`,
        },
      });
    }

    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "character.move",
      target: `character:${name}`,
      metadata: { from: character.accountName, to: destAccount.name, slot: result.slot },
      ip: clientIp(request),
    });

    const moved = await getCharacter(name);
    return { character: moved, slot: result.slot };
  });
}
