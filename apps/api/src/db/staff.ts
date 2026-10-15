import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { managerDb } from "./managerDb.js";
import type { Role } from "../auth/session.js";

export interface StaffUser {
  id: number;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

interface StaffRow extends RowDataPacket {
  id: number;
  email: string;
  role: Role;
  is_active: number;
  created_at: string | null;
  last_login_at: string | null;
}

function toStaff(r: StaffRow): StaffUser {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

export async function listStaff(): Promise<StaffUser[]> {
  const [rows] = await managerDb.query<StaffRow[]>(
    "SELECT id, email, role, is_active, created_at, last_login_at FROM manager_user ORDER BY email ASC",
  );
  return rows.map(toStaff);
}

export async function getStaff(id: number): Promise<StaffUser | null> {
  const [rows] = await managerDb.query<StaffRow[]>(
    "SELECT id, email, role, is_active, created_at, last_login_at FROM manager_user WHERE id = ? LIMIT 1",
    [id],
  );
  const r = rows[0];
  return r ? toStaff(r) : null;
}

/** Create a staff user. Returns the new id, or null if the email already exists. */
export async function createStaff(
  email: string,
  passwordHash: string,
  role: Role,
): Promise<number | null> {
  try {
    const [res] = await managerDb.query<ResultSetHeader>(
      "INSERT INTO manager_user (email, password_hash, role) VALUES (?, ?, ?)",
      [email, passwordHash, role],
    );
    return res.insertId;
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return null;
    throw err;
  }
}

export async function updateStaff(
  id: number,
  updates: { role?: Role; isActive?: boolean },
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (updates.role !== undefined) {
    sets.push("role = ?");
    values.push(updates.role);
  }
  if (updates.isActive !== undefined) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return false;
  values.push(id);
  const [res] = await managerDb.query<ResultSetHeader>(
    `UPDATE manager_user SET ${sets.join(", ")} WHERE id = ?`,
    values,
  );
  return res.affectedRows > 0;
}
