import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp, requireRole } from "../auth/guards.js";
import {
  getServerProperty,
  listServerProperties,
  updateServerPropertyValue,
} from "../db/serverProperties.js";

const listQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const patchBody = z.object({
  value: z.string().max(4000),
});

export async function serverPropertyRoutes(app: FastifyInstance): Promise<void> {
  // Read: any staff.
  app.get("/server-properties", async (request) => {
    const { query, page, pageSize } = listQuery.parse(request.query);
    const items = await listServerProperties({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/server-properties/:key", async (request, reply) => {
    const { key } = request.params as { key: string };
    const property = await getServerProperty(key);
    if (!property) {
      return reply.code(404).send({ error: { code: "not_found", message: "Property not found." } });
    }
    return { property };
  });

  // Write: admin only. Edits the Value column only; audited with old/new value.
  app.patch("/server-properties/:key", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid value." } });
    }

    const existing = await getServerProperty(key);
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Property not found." } });
    }

    if (existing.value === parsed.data.value) {
      return { property: existing, changed: false };
    }

    await updateServerPropertyValue(key, parsed.data.value);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "server_property.update",
      target: `server_property:${key}`,
      metadata: { key, from: existing.value, to: parsed.data.value },
      ip: clientIp(request),
    });

    const property = await getServerProperty(key);
    return { property, changed: true };
  });
}
