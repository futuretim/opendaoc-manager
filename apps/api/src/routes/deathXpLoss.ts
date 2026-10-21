import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import { getServerProperty, updateServerPropertyValue } from "../db/serverProperties.js";
import {
  DEATH_XP_LOSS_KEY,
  DEFAULT_START_LEVEL,
  DISABLED_LEVEL,
  MAX_PLAYER_LEVEL,
  isLossEnabled,
  parseStartLevel,
  targetValueFor,
} from "../db/deathXpLoss.js";

// Enable/disable the setting; `startLevel` is optional and only consulted when
// enabling (ignored when disabling). The shared resolver does range checking.
const patchBody = z.object({
  enabled: z.boolean(),
  startLevel: z.number().int().optional(),
});

function describe(property: {
  key: string;
  description: string;
  defaultValue: string;
  value: string;
}) {
  const startLevel = parseStartLevel(property.value);
  const defaultStartLevel = parseStartLevel(property.defaultValue);
  return {
    key: property.key,
    description: property.description,
    value: property.value,
    startLevel,
    enabled: isLossEnabled(startLevel),
    defaultValue: property.defaultValue,
    defaultStartLevel,
    defaultEnabled: isLossEnabled(defaultStartLevel),
    disabledLevel: DISABLED_LEVEL,
    maxPlayerLevel: MAX_PLAYER_LEVEL,
    defaultStartLevelForEnable: DEFAULT_START_LEVEL,
  };
}

/**
 * Dedicated control for XP loss on death, backed by the `pve_exp_loss_level`
 * ServerProperty. Read is open to any staff; the write is admin-only,
 * validated, and audited with the old/new value — mirroring the generic
 * server-property editor but presented as a simple on/off toggle.
 */
export async function deathXpLossRoutes(app: FastifyInstance): Promise<void> {
  app.get("/death-xp-loss", async (_request, reply) => {
    const property = await getServerProperty(DEATH_XP_LOSS_KEY);
    if (!property) {
      return reply.code(404).send({
        error: { code: "not_found", message: `${DEATH_XP_LOSS_KEY} property not found on this server.` },
      });
    }
    return { setting: describe(property) };
  });

  app.patch("/death-xp-loss", { preHandler: requireRole("admin") }, async (request, reply) => {
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: "An `enabled` flag (boolean) is required." } });
    }

    const target = targetValueFor(parsed.data);
    if (target === null) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: `When enabled, the start level must be a whole number between 1 and ${MAX_PLAYER_LEVEL}.`,
        },
      });
    }

    const existing = await getServerProperty(DEATH_XP_LOSS_KEY);
    if (!existing) {
      return reply.code(404).send({
        error: { code: "not_found", message: `${DEATH_XP_LOSS_KEY} property not found on this server.` },
      });
    }

    if (existing.value === target) {
      return { setting: describe(existing), changed: false };
    }

    await updateServerPropertyValue(DEATH_XP_LOSS_KEY, target);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "death_xp_loss.update",
      target: `server_property:${DEATH_XP_LOSS_KEY}`,
      metadata: { key: DEATH_XP_LOSS_KEY, from: existing.value, to: target, enabled: parsed.data.enabled },
      ip: clientIp(request),
    });

    const property = await getServerProperty(DEATH_XP_LOSS_KEY);
    return { setting: describe(property ?? { ...existing, value: target }), changed: true };
  });
}
