import type { RowDataPacket, ResultSetHeader } from "mysql2";
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
  bountyPoints: number;
  strength: number;
  dexterity: number;
  constitution: number;
  quickness: number;
  intelligence: number;
  piety: number;
  empathy: number;
  charisma: number;
  health: number;
  mana: number;
  endurance: number;
  copper: number;
  silver: number;
  gold: number;
  platinum: number;
  mithril: number;
  guildId: string | null;
  guildName: string | null;
  guildRank: number;
}

const SUMMARY_COLUMNS = "Name, AccountName, Level, Class, Race, Realm, LastPlayed";
const DETAIL_COLUMNS =
  `${SUMMARY_COLUMNS}, AccountSlot, RealmLevel, RealmPoints, BountyPoints, ` +
  `Strength, Dexterity, Constitution, Quickness, Intelligence, Piety, Empathy, Charisma, ` +
  `Health, Mana, Endurance, Copper, Silver, Gold, Platinum, Mithril, ` +
  `GuildID, GuildRank`;
const DETAIL_COLUMNS_WITH_GUILD =
  `${DETAIL_COLUMNS}, ` +
  `(SELECT g.GuildName FROM Guild g WHERE g.GuildID = DOLCharacters.GuildID LIMIT 1) AS GuildName`;

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
    text: `SELECT ${DETAIL_COLUMNS_WITH_GUILD} FROM DOLCharacters WHERE Name = ? LIMIT 1`,
    values: [name],
  };
}

export function buildCharactersForAccountQuery(accountName: string): Sql {
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM DOLCharacters WHERE AccountName = ? ORDER BY LastPlayed DESC`,
    values: [accountName],
  };
}

/** Columns a staff member may update, mapped to their request-body keys. */
export const UPDATABLE_CHARACTER_FIELDS = {
  level: "Level",
  realmLevel: "RealmLevel",
  realmPoints: "RealmPoints",
  bountyPoints: "BountyPoints",
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  quickness: "Quickness",
  intelligence: "Intelligence",
  piety: "Piety",
  empathy: "Empathy",
  charisma: "Charisma",
  health: "Health",
  mana: "Mana",
  endurance: "Endurance",
  copper: "Copper",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  mithril: "Mithril",
} as const;

export type UpdatableCharacterField = keyof typeof UPDATABLE_CHARACTER_FIELDS;

export function buildUpdateCharacterQuery(
  name: string,
  updates: Partial<Record<UpdatableCharacterField, unknown>>,
): Sql {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_CHARACTER_FIELDS)) {
    const field = key as UpdatableCharacterField;
    if (!(field in updates)) continue;
    sets.push(`${column} = ?`);
    values.push(updates[field]);
  }
  if (sets.length === 0) {
    throw new Error("No updatable fields provided");
  }
  values.push(name);
  return {
    text: `UPDATE DOLCharacters SET ${sets.join(", ")} WHERE Name = ?`,
    values,
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
  BountyPoints?: number;
  Strength?: number;
  Dexterity?: number;
  Constitution?: number;
  Quickness?: number;
  Intelligence?: number;
  Piety?: number;
  Empathy?: number;
  Charisma?: number;
  Health?: number;
  Mana?: number;
  Endurance?: number;
  Copper?: number;
  Silver?: number;
  Gold?: number;
  Platinum?: number;
  Mithril?: number;
  GuildID?: string | null;
  GuildRank?: number;
  GuildName?: string | null;
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
    bountyPoints: Number(r.BountyPoints ?? 0),
    strength: Number(r.Strength ?? 0),
    dexterity: Number(r.Dexterity ?? 0),
    constitution: Number(r.Constitution ?? 0),
    quickness: Number(r.Quickness ?? 0),
    intelligence: Number(r.Intelligence ?? 0),
    piety: Number(r.Piety ?? 0),
    empathy: Number(r.Empathy ?? 0),
    charisma: Number(r.Charisma ?? 0),
    health: Number(r.Health ?? 0),
    mana: Number(r.Mana ?? 0),
    endurance: Number(r.Endurance ?? 0),
    copper: Number(r.Copper ?? 0),
    silver: Number(r.Silver ?? 0),
    gold: Number(r.Gold ?? 0),
    platinum: Number(r.Platinum ?? 0),
    mithril: Number(r.Mithril ?? 0),
    guildId: r.GuildID ?? null,
    guildName: r.GuildName ?? null,
    guildRank: Number(r.GuildRank ?? 0),
  };
}

export async function getCharacterId(name: string): Promise<string | null> {
  const [rows] = await gameDb.query<(RowDataPacket & { DOLCharacters_ID: string })[]>(
    "SELECT DOLCharacters_ID FROM DOLCharacters WHERE Name = ? LIMIT 1",
    [name],
  );
  return rows[0]?.DOLCharacters_ID ?? null;
}

export async function charactersForAccount(accountName: string): Promise<CharacterSummary[]> {
  const { text, values } = buildCharactersForAccountQuery(accountName);
  const [rows] = await gameDb.query<CharacterRow[]>(text, values);
  return rows.map(toSummary);
}

export async function characterExists(name: string): Promise<boolean> {
  const [rows] = await gameDb.query<RowDataPacket[]>(
    "SELECT 1 FROM DOLCharacters WHERE Name = ? LIMIT 1",
    [name],
  );
  return rows.length > 0;
}

/**
 * Is this character's account logged in? OpenDAoC stamps account.LastLogin on
 * login and LastDisconnected on disconnect. While the player is online the
 * server holds the character in memory and overwrites DB edits on its next save.
 */
export function buildCharacterOnlineQuery(name: string): Sql {
  return {
    text:
      "SELECT a.Name FROM account a JOIN DOLCharacters c ON c.AccountName = a.Name " +
      "WHERE c.Name = ? AND a.LastLogin IS NOT NULL " +
      "AND (a.LastDisconnected IS NULL OR a.LastLogin > a.LastDisconnected) LIMIT 1",
    values: [name],
  };
}

export async function isCharacterOnline(name: string): Promise<boolean> {
  const { text, values } = buildCharacterOnlineQuery(name);
  const [rows] = await gameDb.query<RowDataPacket[]>(text, values);
  return rows.length > 0;
}

export async function updateCharacter(
  name: string,
  updates: Partial<Record<UpdatableCharacterField, unknown>>,
): Promise<boolean> {
  const { text, values } = buildUpdateCharacterQuery(name, updates);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Character rename.
//
// Only DOLCharacters.Name changes: every other table references a character by
// its stable ObjectId (DOLCharacters_ID), not its name, so nothing cascades.
// Character names are globally unique, so callers must reject a name already
// in use.
// ---------------------------------------------------------------------------

export function buildRenameCharacterQuery(oldName: string, newName: string): Sql {
  return { text: "UPDATE DOLCharacters SET Name = ? WHERE Name = ?", values: [newName, oldName] };
}

export async function renameCharacter(oldName: string, newName: string): Promise<boolean> {
  const { text, values } = buildRenameCharacterQuery(oldName, newName);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Move character to another account.
//
// Mirrors the server's own /account movecharacter: an account's character
// slots are grouped by realm, with a base slot per realm and eight slots each.
// The moved character keeps its realm and takes the first free slot of that
// realm on the destination account.
// ---------------------------------------------------------------------------

/** First AccountSlot for each playable realm (OpenDAoC). */
export const REALM_SLOT_BASE: Record<number, number> = { 1: 100, 2: 200, 3: 300 };
export const SLOTS_PER_REALM = 8;

/**
 * The lowest free slot for `realm` given the slots already occupied on the
 * destination account, or null when the realm is invalid or all eight slots
 * are taken. (The server has a latent bug that lets a 9th character collide on
 * a slot; returning null lets callers reject cleanly instead.)
 */
export function firstFreeSlot(realm: number, occupied: number[]): number | null {
  const base = REALM_SLOT_BASE[realm];
  if (base === undefined) return null;
  const used = new Set(occupied);
  for (let slot = base; slot < base + SLOTS_PER_REALM; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

export function buildOccupiedSlotsQuery(accountName: string, realm: number): Sql {
  return {
    text: "SELECT AccountSlot FROM DOLCharacters WHERE AccountName = ? AND Realm = ?",
    values: [accountName, realm],
  };
}

export function buildMoveCharacterQuery(name: string, toAccount: string, slot: number): Sql {
  return {
    text: "UPDATE DOLCharacters SET AccountName = ?, AccountSlot = ? WHERE Name = ?",
    values: [toAccount, slot, name],
  };
}

export type MoveCharacterResult =
  | { status: "moved"; slot: number }
  | { status: "invalid_realm" }
  | { status: "no_free_slot" };

/**
 * Move `name` to `toAccount`, assigning the first free slot for the
 * character's `realm` on that account. Callers must have verified the
 * character and destination account exist.
 */
export async function moveCharacter(
  name: string,
  toAccount: string,
  realm: number,
): Promise<MoveCharacterResult> {
  if (REALM_SLOT_BASE[realm] === undefined) return { status: "invalid_realm" };

  const occ = buildOccupiedSlotsQuery(toAccount, realm);
  const [rows] = await gameDb.query<(RowDataPacket & { AccountSlot: number })[]>(occ.text, occ.values);
  const slot = firstFreeSlot(
    realm,
    rows.map((r) => Number(r.AccountSlot)),
  );
  if (slot === null) return { status: "no_free_slot" };

  const { text, values } = buildMoveCharacterQuery(name, toAccount, slot);
  await gameDb.query<ResultSetHeader>(text, values);
  return { status: "moved", slot };
}
