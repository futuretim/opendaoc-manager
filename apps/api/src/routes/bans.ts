import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp } from "../auth/guards.js";
import { createBan, liftBan, listBans } from "../db/bans.js";

const listQuery = z.object({
  type: z.enum(["A", "I", "B"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createBody = z
  .object({
    type: z.enum(["A", "I", "B"]),
    account: z.string().trim().max(255).optional(),
    ip: z.string().trim().max(64).optional(),
    reason: z.string().trim().min(1, "A reason is required").max(1000),
  })
  .superRefine((o, ctx) => {
    if ((o.type === "A" || o.type === "B") && !o.account) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "An account name is required for this ban type." });
    }
    if ((o.type === "I" || o.type === "B") && !o.ip) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "An IP is required for this ban type." });
    }
  });

export async function banRoutes(app: FastifyInstance): Promise<void> {
  app.get("/bans", async (request) => {
    const { type, page, pageSize } = listQuery.parse(request.query);
    const items = await listBans({ type, limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, pageSize };
  });

  app.post("/bans", async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid ban." } });
    }

    const ban = await createBan({
      author: request.authUser?.email ?? "unknown",
      type: parsed.data.type,
      // Columns are NOT NULL in the schema; use empty string when N/A.
      account: parsed.data.account ?? "",
      ip: parsed.data.ip ?? "",
      reason: parsed.data.reason,
    });

    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "ban.create",
      target: ban.account ? `account:${ban.account}` : `ip:${ban.ip}`,
      metadata: { type: ban.type, account: ban.account, ip: ban.ip, reason: ban.reason },
      ip: clientIp(request),
    });

    return reply.code(201).send({ ban });
  });

  app.delete("/bans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const lifted = await liftBan(id);
    if (!lifted) {
      return reply.code(404).send({ error: { code: "not_found", message: "Ban not found." } });
    }
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "ban.lift",
      target: `ban:${id}`,
      ip: clientIp(request),
    });
    return { ok: true };
  });
}
