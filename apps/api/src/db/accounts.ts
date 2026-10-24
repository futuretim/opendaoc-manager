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

// ---------------------------------------------------------------------------
// Account rename.
//
// `Name` is the Account table's primary key in OpenDAoC, and several tables
// reference an account by that name string rather than by a stable id, so a
// rename must cascade to all of them or it silently strands data (characters,
// bans, crafting skills, custom params). These (table, column) pairs are the
// account-name references in the stock schema, verified against OpenDAoC-Core.
// AccountXMoney is deliberately absent: despite its `account_id` column name it
// keys off a character's ObjectId, not the account name.
//
// Table/column identifiers here are fixed constants (never user input); only
// the name values are bound as parameters.
// ---------------------------------------------------------------------------

export interface AccountNameReference {
  table: string;
  column: string;
}

export const ACCOUNT_NAME_REFERENCES: AccountNameReference[] = [
  { table: "DOLCharacters", column: "AccountName" },
  { table: "DOLCharactersBackup", column: "AccountName" },
  { table: "Ban", column: "Account" },
  { table: "AccountXCrafting", column: "AccountId" },
  { table: "AccountXCustomParam", column: "Name" },
];

export function buildRenameReferenceQuery(
  ref: AccountNameReference,
  oldName: string,
  newName: string,
): Sql {
  return {
    text: `UPDATE \`${ref.table}\` SET \`${ref.column}\` = ? WHERE \`${ref.column}\` = ?`,
    values: [newName, oldName],
  };
}

export function buildRenameAccountQuery(oldName: string, newName: string): Sql {
  return { text: "UPDATE account SET Name = ? WHERE Name = ?", values: [newName, oldName] };
}

export interface RenameAccountResult {
  cascades: { table: string; column: string; updated: number }[];
}

/**
 * Rename an account, cascading to every account-name reference that exists in
 * this schema, atomically. References missing from a given install are skipped
 * (custom schemas vary) rather than failing the whole rename.
 */
export async function renameAccount(oldName: string, newName: string): Promise<RenameAccountResult> {
  const conn = await gameDb.getConnection();
  try {
    await conn.beginTransaction();

    // Which referenced (table, column) pairs actually exist here? Compared
    // case-insensitively so schema casing never causes a false "missing".
    const [cols] = await conn.query<RowDataPacket[]>(
      "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
    );
    const present = new Set(
      cols.map((c) => `${String(c.TABLE_NAME).toLowerCase()}.${String(c.COLUMN_NAME).toLowerCase()}`),
    );

    const cascades: { table: string; column: string; updated: number }[] = [];
    for (const ref of ACCOUNT_NAME_REFERENCES) {
      if (!present.has(`${ref.table.toLowerCase()}.${ref.column.toLowerCase()}`)) continue;
      const { text, values } = buildRenameReferenceQuery(ref, oldName, newName);
      const [res] = await conn.query<ResultSetHeader>(text, values);
      cascades.push({ table: ref.table, column: ref.column, updated: res.affectedRows });
    }

    const { text, values } = buildRenameAccountQuery(oldName, newName);
    await conn.query<ResultSetHeader>(text, values);

    await conn.commit();
    return { cascades };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
