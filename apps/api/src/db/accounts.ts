import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { gameDb } from "./gameDb.js";

/** A buildable SQL statement: parameterized text + bound values. */
export interface Sql {
  text: string;
  values: unknown[];
}

export interface AccountSummary {
  name: string;
  privLevel: number;
  realm: number;
  creationDate: string | null;
  lastLogin: string | null;
  discordId: string | null;
}

export interface AccountDetail extends AccountSummary {
  status: number;
  isMuted: boolean;
  isWarned: boolean;
  isTester: boolean;
  notes: string | null;
  mail: string | null;
  lastLoginIP: string | null;
  lastClientVersion: string | null;
}

const SUMMARY_COLUMNS =
  "Name, PrivLevel, Realm, CreationDate, LastLogin, DiscordID";

const DETAIL_COLUMNS =
  "Name, PrivLevel, Realm, CreationDate, LastLogin, DiscordID, Status, IsMuted, IsWarned, IsTester, Notes, Mail, LastLoginIP, LastClientVersion";

// ---------------------------------------------------------------------------
// Query builders (pure — unit-testable without a database connection).
// ---------------------------------------------------------------------------

export function buildSearchAccountsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM account ` +
        `WHERE Name LIKE ? OR DiscordID LIKE ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM account ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetAccountQuery(name: string): Sql {
  return {
    text: `SELECT ${DETAIL_COLUMNS} FROM account WHERE Name = ? LIMIT 1`,
    values: [name],
  };
}

export function buildResetPasswordQuery(name: string, passwordHash: string): Sql {
  return {
    text: `UPDATE account SET Password = ? WHERE Name = ?`,
    values: [passwordHash, name],
  };
}

/** Columns a staff member may update, mapped to their request-body keys. */
export const UPDATABLE_ACCOUNT_FIELDS = {
  privLevel: "PrivLevel",
  status: "Status",
  isMuted: "IsMuted",
  isWarned: "IsWarned",
  isTester: "IsTester",
  notes: "Notes",
} as const;

export type UpdatableField = keyof typeof UPDATABLE_ACCOUNT_FIELDS;

export function buildUpdateAccountQuery(
  name: string,
  updates: Partial<Record<UpdatableField, unknown>>,
): Sql {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_ACCOUNT_FIELDS)) {
    const field = key as UpdatableField;
    if (!(field in updates)) continue;
    let value = updates[field];
    if (field === "isMuted" || field === "isWarned" || field === "isTester") {
      value = value ? 1 : 0;
    }
    sets.push(`${column} = ?`);
    values.push(value);
  }
  if (sets.length === 0) {
    throw new Error("No updatable fields provided");
  }
  values.push(name);
  return {
    text: `UPDATE account SET ${sets.join(", ")} WHERE Name = ?`,
    values,
  };
}

// ---------------------------------------------------------------------------
// Executors.
// ---------------------------------------------------------------------------

interface AccountRow extends RowDataPacket {
  Name: string;
  PrivLevel: number;
  Realm: number;
  CreationDate: string | null;
  LastLogin: string | null;
  DiscordID: string | null;
  Status?: number;
  IsMuted?: number;
  IsWarned?: number;
  IsTester?: number;
  Notes?: string | null;
  Mail?: string | null;
  LastLoginIP?: string | null;
  LastClientVersion?: string | null;
}

function toSummary(r: AccountRow): AccountSummary {
  return {
    name: r.Name,
    privLevel: Number(r.PrivLevel),
    realm: Number(r.Realm),
    creationDate: r.CreationDate,
    lastLogin: r.LastLogin,
    discordId: r.DiscordID,
  };
}

export async function searchAccounts(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<AccountSummary[]> {
  const { text, values } = buildSearchAccountsQuery(params);
  const [rows] = await gameDb.query<AccountRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getAccount(name: string): Promise<AccountDetail | null> {
  const { text, values } = buildGetAccountQuery(name);
  const [rows] = await gameDb.query<AccountRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    status: Number(r.Status ?? 0),
    isMuted: Boolean(r.IsMuted),
    isWarned: Boolean(r.IsWarned),
    isTester: Boolean(r.IsTester),
    notes: r.Notes ?? null,
    mail: r.Mail ?? null,
    lastLoginIP: r.LastLoginIP ?? null,
    lastClientVersion: r.LastClientVersion ?? null,
  };
}

export async function accountExists(name: string): Promise<boolean> {
  const [rows] = await gameDb.query<RowDataPacket[]>(
    "SELECT 1 FROM account WHERE Name = ? LIMIT 1",
    [name],
  );
  return rows.length > 0;
}

export async function resetPassword(name: string, passwordHash: string): Promise<boolean> {
  const { text, values } = buildResetPasswordQuery(name, passwordHash);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

export async function updateAccount(
  name: string,
  updates: Partial<Record<UpdatableField, unknown>>,
): Promise<boolean> {
  const { text, values } = buildUpdateAccountQuery(name, updates);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}
