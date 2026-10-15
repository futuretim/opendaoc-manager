import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { managerDb } from "./managerDb.js";
import type { AuthUser, Role } from "../auth/session.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface SessionUserRow extends RowDataPacket {
  id: number;
  email: string;
  role: Role;
  expires_at: string;
}

/** Create a server-side session row and return its id. */
export async function createSession(userId: number): Promise<string> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await managerDb.query("INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)", [
    id,
    userId,
    expiresAt,
  ]);
  return id;
}

/**
 * Resolve a session id to its (active) user, or null. Expired sessions are
 * deleted on read. This is what makes sessions revocable: deleting the row
 * (logout, deactivation, password change) invalidates it immediately.
 */
export async function getSessionUser(sessionId: string): Promise<AuthUser | null> {
  const [rows] = await managerDb.query<SessionUserRow[]>(
    `SELECT u.id, u.email, u.role, s.expires_at
       FROM session s
       JOIN manager_user u ON u.id = s.user_id
      WHERE s.id = ? AND u.is_active = 1
      LIMIT 1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deleteSession(sessionId);
    return null;
  }
  return { id: row.id, email: row.email, role: row.role };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await managerDb.query("DELETE FROM session WHERE id = ?", [sessionId]);
}

/** Revoke every session for a user (used on deactivation / role change). */
export async function deleteUserSessions(userId: number): Promise<void> {
  await managerDb.query("DELETE FROM session WHERE user_id = ?", [userId]);
}
