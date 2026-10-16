import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp } from "../auth/guards.js";
import { cryptGamePassword } from "../auth/password.js";
import {
  accountExists,
  getAccount,
  resetPassword,
  searchAccounts,
  updateAccount,
  type UpdatableField,
} from "../db/accounts.js";
import { accountBanStatus } from "../db/bans.js";
import { charactersForAccount } from "../db/characters.js";

const pageQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// OpenDAoC login names/passwords are ASCII; keep resets conservative.
const resetBody = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(20, "Password must be at most 20 characters")
    .regex(/^[\x21-\x7e]+$/, "Password must be printable ASCII with no spaces"),
});

const patchBody = z
  .object({
    privLevel: z.number().int().min(1).max(3).optional(),
    status: z.number().int().min(0).max(255).optional(),
    isMuted: z.boolean().optional(),
    isWarned: z.boolean().optional(),
    isTester: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get("/accounts", async (request) => {
    const { query, page, pageSize } = pageQuery.parse(request.query);
    const items = await searchAccounts({
      q: query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });

  app.get("/accounts/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const account = await getAccount(name);
    if (!account) {
      return reply.code(404).send({ error: { code: "not_found", message: "Account not found." } });
    }
    const [characters, bans] = await Promise.all([
      charactersForAccount(name),
      accountBanStatus(name),
    ]);
    return { account, characters, bans };
  });

  app.post("/accounts/:name/reset-password", async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = resetBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid password." } });
    }
    if (!(await accountExists(name))) {
      return reply.code(404).send({ error: { code: "not_found", message: "Account not found." } });
    }

    const hash = cryptGamePassword(parsed.data.password);
    await resetPassword(name, hash);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "account.reset_password",
      target: `account:${name}`,
      ip: clientIp(request),
    });
    return { ok: true };
  });

  app.patch("/accounts/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }

    // PrivLevel changes are admin-only; everything else is allowed for GMs.
    if (parsed.data.privLevel !== undefined && request.authUser?.role !== "admin") {
      return reply
        .code(403)
        .send({ error: { code: "forbidden", message: "Changing privilege level requires admin role." } });
    }

    if (!(await accountExists(name))) {
      return reply.code(404).send({ error: { code: "not_found", message: "Account not found." } });
    }

    await updateAccount(name, parsed.data as Partial<Record<UpdatableField, unknown>>);
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "account.update",
      target: `account:${name}`,
      metadata: parsed.data,
      ip: clientIp(request),
    });

    const account = await getAccount(name);
    return { account };
  });
}
