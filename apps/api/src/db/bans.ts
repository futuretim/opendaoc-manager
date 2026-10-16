import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

/** Ban type codes as used by the game server (AbstractServerRules). */
export type BanType = "A" | "I" | "B"; // Account, IP, Both

export interface Ban {
  id: string;
  author: string;
  type: BanType;
  ip: string;
  account: string;
  dateBan: string | null;
  reason: string;
}

const COLUMNS = "Ban_ID, Author, Type, Ip, Account, DateBan, Reason";

export function buildListBansQuery(params: {
  type?: BanType;
  limit: number;
  offset: number;
}): Sql {
  const { type, limit, offset } = params;
  if (type) {
    return {
      text: `SELECT ${COLUMNS} FROM Ban WHERE Type = ? ORDER BY DateBan DESC LIMIT ? OFFSET ?`,
      values: [type, limit, offset],
    };
  }
  return {
    text: `SELECT ${COLUMNS} FROM Ban ORDER BY DateBan DESC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildCreateBanQuery(input: {
  id: string;
  author: string;
  type: BanType;
  ip: string;
  account: string;
  reason: string;
}): Sql {
  return {
    text:
      `INSERT INTO Ban (Ban_ID, Author, Type, Ip, Account, DateBan, Reason) ` +
      `VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
    values: [input.id, input.author, input.type, input.ip, input.account, input.reason],
  };
}

export function buildLiftBanQuery(id: string): Sql {
  return { text: `DELETE FROM Ban WHERE Ban_ID = ?`, values: [id] };
}

/** Matches the server's account-ban check: Type A or B for this account. */
export function buildAccountBanStatusQuery(account: string): Sql {
  return {
    text: `SELECT ${COLUMNS} FROM Ban WHERE (Type = 'A' OR Type = 'B') AND Account = ?`,
    values: [account],
  };
}

interface BanRow extends RowDataPacket {
  Ban_ID: string;
  Author: string;
  Type: BanType;
  Ip: string;
  Account: string;
  DateBan: string | null;
  Reason: string;
}

function toBan(r: BanRow): Ban {
  return {
    id: r.Ban_ID,
    author: r.Author,
    type: r.Type,
    ip: r.Ip,
    account: r.Account,
    dateBan: r.DateBan,
    reason: r.Reason,
  };
}

export async function listBans(params: {
  type?: BanType;
  limit: number;
  offset: number;
}): Promise<Ban[]> {
  const { text, values } = buildListBansQuery(params);
  const [rows] = await gameDb.query<BanRow[]>(text, values);
  return rows.map(toBan);
}

export async function createBan(input: {
  author: string;
  type: BanType;
  ip: string;
  account: string;
  reason: string;
}): Promise<Ban> {
  const id = randomUUID();
  const { text, values } = buildCreateBanQuery({ id, ...input });
  await gameDb.query<ResultSetHeader>(text, values);
  return { id, dateBan: null, ...input };
}

export async function liftBan(id: string): Promise<boolean> {
  const { text, values } = buildLiftBanQuery(id);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

export async function accountBanStatus(account: string): Promise<Ban[]> {
  const { text, values } = buildAccountBanStatusQuery(account);
  const [rows] = await gameDb.query<BanRow[]>(text, values);
  return rows.map(toBan);
}
