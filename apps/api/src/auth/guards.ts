import type { FastifyReply, FastifyRequest } from "fastify";
import { getSessionUser } from "../db/sessions.js";
import { readSessionId, type AuthUser, type Role } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/** preHandler: require a valid session; attaches request.authUser. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = readSessionId(request);
  const user = sessionId === null ? null : await getSessionUser(sessionId);
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
