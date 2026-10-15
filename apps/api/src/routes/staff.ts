import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { writeAudit } from "../audit.js";
import { clientIp } from "../auth/guards.js";
import { hashStaffPassword } from "../auth/password.js";
import { createStaff, getStaff, listStaff, updateStaff } from "../db/staff.js";
import { deleteUserSessions } from "../db/sessions.js";

const createBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "gm"]).default("gm"),
});

const patchBody = z
  .object({
    role: z.enum(["admin", "gm"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  app.get("/staff", async () => ({ items: await listStaff() }));

  app.post("/staff", async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }
    const id = await createStaff(
      parsed.data.email,
      hashStaffPassword(parsed.data.password),
      parsed.data.role,
    );
    if (id === null) {
      return reply
        .code(409)
        .send({ error: { code: "conflict", message: "A user with that email already exists." } });
    }
    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "staff.create",
      target: `staff:${parsed.data.email}`,
      metadata: { role: parsed.data.role },
      ip: clientIp(request),
    });
    const user = await getStaff(id);
    return reply.code(201).send({ user });
  });

  app.patch("/staff/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "Invalid id." } });
    }
    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid payload." } });
    }

    // Guard against self-lockout: an admin cannot deactivate or demote themselves.
    if (id === request.authUser?.id) {
      if (parsed.data.isActive === false || parsed.data.role === "gm") {
        return reply.code(400).send({
          error: { code: "bad_request", message: "You cannot deactivate or demote your own account." },
        });
      }
    }

    const existing = await getStaff(id);
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Staff user not found." } });
    }

    await updateStaff(id, parsed.data);

    // Revoke the user's sessions when their access changes, so it takes effect now.
    if (parsed.data.isActive === false || parsed.data.role !== undefined) {
      await deleteUserSessions(id);
    }

    await writeAudit({
      actorUserId: request.authUser?.id ?? null,
      action: "staff.update",
      target: `staff:${existing.email}`,
      metadata: parsed.data,
      ip: clientIp(request),
    });

    const user = await getStaff(id);
    return { user };
  });
}
