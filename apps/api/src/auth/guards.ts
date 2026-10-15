import type { FastifyReply, FastifyRequest } from "fastify";
import type { RowDataPacket } from "mysql2";
import { managerDb } from "../db/managerDb.js";
import { readSessionUserId, type AuthUser, type Role } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  role: Role;
}

async function loadUser(id: number): Promise<AuthUser | null> {
  const [rows] = await managerDb.query<UserRow[]>(
    "SELECT id, email, role FROM manager_user WHERE id = ? AND is_active = 1 LIMIT 1",
    [id],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, role: row.role } : null;
}

/** preHandler: require a valid session; attaches request.authUser. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = readSessionUserId(request);
  const user = id === null ? null : await loadUser(id);
  if (!user) {
    await reply.code(401).send({ error: { code: "unauthorized", message: "Not authenticated." } });
    return;
  }
  request.authUser = user;
}

/** preHandler factory: require a specific role (after requireAuth). */
export function requireRole(role: Role) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (request.authUser?.role !== role) {
      await reply
        .code(403)
        .send({ error: { code: "forbidden", message: `Requires ${role} role.` } });
    }
  };
}

export function clientIp(request: FastifyRequest): string {
  return request.ip;
}
