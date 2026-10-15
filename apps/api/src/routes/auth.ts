import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { managerDb } from "../db/managerDb.js";
import { createSession, deleteSession, getSessionUser } from "../db/sessions.js";
import { verifyStaffPassword } from "../auth/password.js";
import {
  clearSessionCookie,
  readSessionId,
  setSessionCookie,
  type AuthUser,
} from "../auth/session.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  role: "admin" | "gm";
}

async function findActiveUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await managerDb.query<UserRow[]>(
    "SELECT id, email, password_hash, role FROM manager_user WHERE email = ? AND is_active = 1 LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "bad_request", message: "Invalid credentials payload." } });
    }

    const user = await findActiveUserByEmail(parsed.data.email);
    // Always run a verify to reduce user-enumeration timing differences.
    const ok = user
      ? verifyStaffPassword(parsed.data.password, user.password_hash)
      : verifyStaffPassword(parsed.data.password, "scrypt$16384$8$1$AAAA$AAAA");

    if (!user || !ok) {
      return reply
        .code(401)
        .send({ error: { code: "unauthorized", message: "Invalid email or password." } });
    }

    await managerDb
      .query("UPDATE manager_user SET last_login_at = NOW() WHERE id = ?", [user.id])
      .catch(() => undefined);

    const sessionId = await createSession(user.id);
    setSessionCookie(reply, sessionId);
    return { user: { id: user.id, email: user.email, role: user.role } satisfies AuthUser };
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = readSessionId(request);
    if (sessionId) await deleteSession(sessionId);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionId = readSessionId(request);
    const user = sessionId ? await getSessionUser(sessionId) : null;
    if (!user) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: { code: "unauthorized", message: "Not authenticated." } });
    }
    return { user };
  });
}
