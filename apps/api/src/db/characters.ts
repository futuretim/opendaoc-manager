import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface CharacterSummary {
  name: string;
  accountName: string;
  level: number;
  class: number;
  race: number;
  realm: number;
  lastPlayed: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  accountSlot: number;
  realmLevel: number;
  realmPoints: number;
}

const SUMMARY_COLUMNS = "Name, AccountName, Level, Class, Race, Realm, LastPlayed";
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, AccountSlot, RealmLevel, RealmPoints`;

export function buildSearchCharactersQuery(params: {
  q?: string;
  realm?: number;
  limit: number;
  offset: number;
}): Sql {
  const { q, realm, limit, offset } = params;
  const where: string[] = [];
  const values: unknown[] = [];

  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    where.push("(Name LIKE ? OR AccountName LIKE ?)");
    values.push(like, like);
  }
  if (typeof realm === "number") {
    where.push("Realm = ?");
    values.push(realm);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")} ` : "";
  values.push(limit, offset);
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM DOLCharacters ${whereClause}ORDER BY LastPlayed DESC LIMIT ? OFFSET ?`,
    values,
  };
}

export function buildGetCharacterQuery(name: string): Sql {
  return {
    text: `SELECT ${DETAIL_COLUMNS} FROM DOLCharacters WHERE Name = ? LIMIT 1`,
    values: [name],
  };
}

export function buildCharactersForAccountQuery(accountName: string): Sql {
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM DOLCharacters WHERE AccountName = ? ORDER BY LastPlayed DESC`,
    values: [accountName],
  };
}

interface CharacterRow extends RowDataPacket {
  Name: string;
  AccountName: string;
  Level: number;
  Class: number;
  Race: number;
  Realm: number;
  LastPlayed: string | null;
  AccountSlot?: number;
  RealmLevel?: number;
  RealmPoints?: number;
}

function toSummary(r: CharacterRow): CharacterSummary {
  return {
    name: r.Name,
    accountName: r.AccountName,
    level: Number(r.Level),
    class: Number(r.Class),
    race: Number(r.Race),
    realm: Number(r.Realm),
    lastPlayed: r.LastPlayed,
  };
}

export async function searchCharacters(params: {
  q?: string;
  realm?: number;
  limit: number;
  offset: number;
}): Promise<CharacterSummary[]> {
  const { text, values } = buildSearchCharactersQuery(params);
  const [rows] = await gameDb.query<CharacterRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getCharacter(name: string): Promise<CharacterDetail | null> {
  const { text, values } = buildGetCharacterQuery(name);
  const [rows] = await gameDb.query<CharacterRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    accountSlot: Number(r.AccountSlot ?? 0),
    realmLevel: Number(r.RealmLevel ?? 0),
    realmPoints: Number(r.RealmPoints ?? 0),
  };
}

export async function charactersForAccount(accountName: string): Promise<CharacterSummary[]> {
  const { text, values } = buildCharactersForAccountQuery(accountName);
  const [rows] = await gameDb.query<CharacterRow[]>(text, values);
  return rows.map(toSummary);
}
