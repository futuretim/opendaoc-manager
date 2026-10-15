import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Minimal cookie-based session for the M0 scaffold.
 *
 * The signed cookie carries the authenticated staff user id. This is a
 * stateless stub; M1 will back sessions with the `session` table (see
 * migrations/001_init.sql) so they can be revoked and expired server-side.
 */
export const SESSION_COOKIE = "odm_session";

export type Role = "admin" | "gm";

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export function setSessionCookie(reply: FastifyReply, userId: number): void {
  reply.setCookie(SESSION_COOKIE, String(userId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    signed: true,
    secure: reply.request.server.config.COOKIE_SECURE,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Reads and verifies the signed session cookie, returning the user id or null. */
export function readSessionUserId(request: FastifyRequest): number | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value === null) return null;
  const id = Number(unsigned.value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
