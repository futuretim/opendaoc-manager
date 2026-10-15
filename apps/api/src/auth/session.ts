import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Cookie-backed, server-side session.
 *
 * The signed cookie carries an opaque session id; the authoritative session
 * state lives in the `session` table (see db/sessions.ts), which makes
 * sessions revocable (logout, deactivation, password change).
 */
export const SESSION_COOKIE = "odm_session";

export type Role = "admin" | "gm";

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // keep cookie lifetime in step with the row TTL

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
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

/** Reads and verifies the signed session cookie, returning the session id. */
export function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value === null) return null;
  return unsigned.value;
}
