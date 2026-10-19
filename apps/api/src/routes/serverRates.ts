import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import { getServerProperty, updateServerPropertyValue } from "../db/serverProperties.js";
import { XP_RATE_KEY, MAX_XP_MULTIPLIER, normalizeMultiplier, parseMultiplier } from "../db/serverRates.js";

// Accept a bare number or a numeric string (e.g. "2.5"); the shared
// normalizer does the range/finiteness checking.
const patchBody = z.object({
  value: z.union([z.number(), z.string()]),
});

function describe(property: {
  key: string;
  description: string;
  defaultValue: string;
  value: string;
}) {
  return {
    key: property.key,
    description: property.description,
    defaultValue: property.defaultValue,
    defaultMultiplier: parseMultiplier(property.defaultValue),
    value: property.value,
    multiplier: parseMultiplier(property.value),
    max: MAX_XP_MULTIPLIER,
  };
}

/**
 * Dedicated, validated control for the global XP multiplier (`xp_rate`).
 * Read is open to any staff; the write is admin-only, numerically validated,
 * and audited with the old/new value — mirroring the generic server-property
 * editor but purpose-built for this one high-impact setting.
 */
export async function serverRateRoutes(app: FastifyInstance): Promise<void> {
  app.get("/server-rates/xp", async (_request, reply) => {
    const property = await getServerProperty(XP_RATE_KEY);
    if (!property) {
      return reply
        .code(404)
        .send({ error: { code: "not_found", message: "xp_rate property not found on this server." } });
    }
    return { rate: describe(property) };
  });

  app.patch("/server-rates/xp", { preHandler: requireRole("admin") }, async (request, reply) => {
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: "A numeric multiplier is required." } });
    }

    const normalized = normalizeMultiplier(parsed.data.value);
    if (normalized === null) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: `The XP multiplier must be a number between 0 and ${MAX_XP_MULTIPLIER}.`,
        },
      });
    }

    const existing = await getServerProperty(XP_RATE_KEY);
    if (!existing) {
      return reply
        .code(404)
        .send({ error: { code: "not_found", message: "xp_rate property not found on this server." } });
    }

    if (existing.value === normalized) {
      return { rate: describe(existing), changed: false };
    }

    await updateServerPropertyValue(XP_RATE_KEY, normalized);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "server_rate.update",
      target: `server_property:${XP_RATE_KEY}`,
      metadata: { key: XP_RATE_KEY, from: existing.value, to: normalized },
      ip: clientIp(request),
    });

    const property = await getServerProperty(XP_RATE_KEY);
    return { rate: describe(property ?? { ...existing, value: normalized }), changed: true };
  });
}
