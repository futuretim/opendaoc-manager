import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import { getCharacter, getCharacterId, type CharacterDetail } from "../db/characters.js";
import {
  ACCOUNT_VAULTS,
  accountVaultOwnerId,
  generateInventoryId,
  getAccountInventory,
  getCharacterInventory,
  getGuildInventory,
  getInventoryItem,
  getItemTemplateStack,
  grantInventoryItem,
  isOwnerOnline,
  isSlotOccupied,
  isWritableSlot,
  maxStackCount,
  scopeForSlot,
  updateInventoryItem,
  deleteInventoryItem,
  VAULT_SIZE,
  type InventoryScope,
  type UpdatableInventoryField,
} from "../db/inventory.js";
import { gameDb } from "../db/gameDb.js";
import type { RowDataPacket } from "mysql2";

const ONLINE_MESSAGE =
  "A player who holds this inventory is online. The game server keeps it in memory and " +
  "would overwrite or duplicate the change; try again once they have logged out.";

const scopeSchema = z.enum(["character", "guild", "account"]);

/** Resolve the inventory owner ID for a scope + character. */
async function resolveOwner(
  scope: InventoryScope,
  character: CharacterDetail,
): Promise<{ ownerId: string; label: string } | null> {
  if (scope === "character") {
    const id = await getCharacterId(character.name);
    if (!id) return null;
    return { ownerId: id, label: `character:${character.name}` };
  }

  if (scope === "guild") {
    if (!character.guildId) return null;
    return { ownerId: character.guildId, label: `guild:${character.guildName ?? character.guildId}` };
  }

  return {
    ownerId: accountVaultOwnerId(character.accountName, character.realm),
    label: `account:${character.accountName}`,
  };
}

const listQuery = z.object({
  scope: scopeSchema.default("character"),
});

const patchItemBody = z
  .object({
    slotPosition: z.number().int().min(0).max(2699).optional(),
    count: z.number().int().min(1).max(999999).optional(),
    sellPrice: z.number().int().min(0).max(2_000_000_000).optional(),
    color: z.number().int().min(0).max(65535).optional(),
    emblem: z.number().int().min(0).max(65535).optional(),
    condition: z.number().int().min(0).max(65535).optional(),
    durability: z.number().int().min(0).max(65535).optional(),
    charges: z.number().int().min(0).max(255).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

const grantBody = z.object({
  scope: scopeSchema.default("character"),
  itemTemplateId: z.string().trim().min(1, "Item template ID is required"),
  slotPosition: z.number().int().min(0).max(2699),
  count: z.number().int().min(1).max(999999).default(1),
  sellPrice: z.number().int().min(0).max(2_000_000_000).default(0),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  // List inventory items for a character (by scope).
  app.get("/characters/:name/inventory", async (request, reply) => {
    const { name } = request.params as { name: string };
    const { scope } = listQuery.parse(request.query);

    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }

    const resolved = await resolveOwner(scope, character);
    if (!resolved) {
      const msg =
        scope === "guild"
          ? "This character is not in a guild."
          : scope === "account"
            ? "Could not resolve account vault."
            : "Could not resolve character inventory.";
      return reply.code(404).send({ error: { code: "not_found", message: msg } });
    }

    let items;
    if (scope === "character") {
      items = await getCharacterInventory(resolved.ownerId);
    } else if (scope === "guild") {
      items = await getGuildInventory(resolved.ownerId);
    } else {
      items = await getAccountInventory(character.accountName, character.realm);
    }

    return {
      scope,
      ownerId: resolved.ownerId,
      guildName: scope === "guild" ? character.guildName : undefined,
      accountName: scope === "account" ? character.accountName : undefined,
      items,
    };
  });

  // Get a single inventory item.
  app.get("/inventory/:inventoryId", async (request, reply) => {
    const { inventoryId } = request.params as { inventoryId: string };
    const item = await getInventoryItem(inventoryId);
    if (!item) {
      return reply.code(404).send({ error: { code: "not_found", message: "Inventory item not found." } });
    }
    return { item };
  });

  // Update an inventory item (move slot, change count, price, color, etc.).
  app.patch("/inventory/:inventoryId", async (request, reply) => {
    const { inventoryId } = request.params as { inventoryId: string };
    const parsed = patchItemBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }

    const existing = await getInventoryItem(inventoryId);
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Inventory item not found." } });
    }

    const updates = parsed.data as Partial<Record<UpdatableInventoryField, unknown>>;
    const scope = scopeForSlot(existing.slotPosition);
    if (!scope) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: `Slot ${existing.slotPosition} is not managed here.` } });
    }

    // Only a changed count is checked, so moving an item with odd existing data still works.
    const newCount = parsed.data.count;
    if (typeof newCount === "number" && newCount !== existing.count && newCount > maxStackCount(existing)) {
      return reply.code(400).send({
        error: { code: "bad_request", message: `Count must be at most ${maxStackCount(existing)} for this item.` },
      });
    }

    // A move stays inside the item's own scope (an owner ID only means something
    // for its own slot ranges) and never targets an equipment slot.
    const newSlot = parsed.data.slotPosition;
    if (typeof newSlot === "number" && newSlot !== existing.slotPosition) {
      if (!isWritableSlot(scope, newSlot)) {
        return reply.code(400).send({
          error: { code: "bad_request", message: `Slot ${newSlot} is not a ${scope} bag or vault slot.` },
        });
      }
      if (await isSlotOccupied(existing.ownerId, newSlot)) {
        return reply.code(409).send({
          error: {
            code: "conflict",
            message: `Slot ${newSlot} is already occupied for this owner.`,
          },
        });
      }
    }

    if (await isOwnerOnline(existing.ownerId)) {
      return reply.code(409).send({ error: { code: "player_online", message: ONLINE_MESSAGE } });
    }

    await updateInventoryItem(inventoryId, updates);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "inventory.update",
      target: `inventory:${inventoryId}`,
      metadata: { ownerId: existing.ownerId, ...updates },
      ip: clientIp(request),
    });

    const item = await getInventoryItem(inventoryId);
    return { item };
  });

  // Delete (remove) an inventory item.
  // Admin-only, like character rename/move.
  app.delete("/inventory/:inventoryId", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { inventoryId } = request.params as { inventoryId: string };

    const existing = await getInventoryItem(inventoryId);
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Inventory item not found." } });
    }

    if (await isOwnerOnline(existing.ownerId)) {
      return reply.code(409).send({ error: { code: "player_online", message: ONLINE_MESSAGE } });
    }

    await deleteInventoryItem(inventoryId);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "inventory.delete",
      target: `inventory:${inventoryId}`,
      metadata: {
        ownerId: existing.ownerId,
        slotPosition: existing.slotPosition,
        itemName: existing.name,
        itemTemplateId: existing.itemTemplateId,
        count: existing.count,
      },
      ip: clientIp(request),
    });

    return { ok: true };
  });

  // Grant (create) an inventory item from an ItemTemplate.
  // Admin-only, like character rename/move.
  app.post("/characters/:name/inventory/grant", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = grantBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }
    const { scope, itemTemplateId, slotPosition, count, sellPrice } = parsed.data;

    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }

    const resolved = await resolveOwner(scope, character);
    if (!resolved) {
      const msg =
        scope === "guild"
          ? "This character is not in a guild."
          : scope === "account"
            ? "Could not resolve account vault."
            : "Could not resolve character inventory.";
      return reply.code(404).send({ error: { code: "not_found", message: msg } });
    }

    if (!isWritableSlot(scope, slotPosition)) {
      return reply.code(400).send({
        error: { code: "bad_request", message: `Slot ${slotPosition} is not a ${scope} bag or vault slot.` },
      });
    }

    const template = await getItemTemplateStack(itemTemplateId);
    if (!template) {
      return reply
        .code(404)
        .send({ error: { code: "not_found", message: `Item template "${itemTemplateId}" not found.` } });
    }
    if (count > maxStackCount(template)) {
      return reply.code(400).send({
        error: { code: "bad_request", message: `Count must be at most ${maxStackCount(template)} for this item.` },
      });
    }

    if (await isOwnerOnline(resolved.ownerId)) {
      return reply.code(409).send({ error: { code: "player_online", message: ONLINE_MESSAGE } });
    }

    if (await isSlotOccupied(resolved.ownerId, slotPosition)) {
      return reply.code(409).send({
        error: {
          code: "conflict",
          message: `Slot ${slotPosition} is already occupied for this owner.`,
        },
      });
    }

    const inventoryId = generateInventoryId();
    const granted = await grantInventoryItem({
      inventoryId,
      ownerId: resolved.ownerId,
      slotPosition,
      itemTemplateId,
      count,
      sellPrice,
    });

    if (!granted) {
      return reply
        .code(500)
        .send({ error: { code: "error", message: "Failed to create inventory item." } });
    }

    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "inventory.grant",
      target: `inventory:${inventoryId}`,
      metadata: {
        scope,
        owner: resolved.label,
        itemTemplateId,
        slotPosition,
        count,
        sellPrice,
      },
      ip: clientIp(request),
    });

    const item = await getInventoryItem(inventoryId);
    return { item };
  });

  // List guild info for a character (helper for the UI).
  app.get("/characters/:name/guild", async (request, reply) => {
    const { name } = request.params as { name: string };
    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }
    if (!character.guildId) {
      return { guild: null };
    }
    // Fetch guild details.
    const [rows] = await gameDb.query<(RowDataPacket & { GuildName: string; Realm: number; GuildLevel: number })[]>(
      "SELECT GuildName, Realm, GuildLevel FROM Guild WHERE GuildID = ? LIMIT 1",
      [character.guildId],
    );
    const g = rows[0];
    return {
      guild: {
        guildId: character.guildId,
        guildName: g?.GuildName ?? character.guildName,
        realm: Number(g?.Realm ?? character.realm),
        guildLevel: Number(g?.GuildLevel ?? 0),
        guildRank: character.guildRank,
      },
    };
  });

  // Account vault info: which vault pages exist.
  app.get("/characters/:name/account-vault-info", async (request, reply) => {
    const { name } = request.params as { name: string };
    const character = await getCharacter(name);
    if (!character) {
      return reply.code(404).send({ error: { code: "not_found", message: "Character not found." } });
    }
    return {
      accountName: character.accountName,
      realm: character.realm,
      ownerId: accountVaultOwnerId(character.accountName, character.realm),
      vaultCount: ACCOUNT_VAULTS,
      vaultSize: VAULT_SIZE,
    };
  });
}
