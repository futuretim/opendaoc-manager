import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface MobSummary {
  id: string;
  name: string;
  level: number;
  realm: number;
  region: number;
  x: number;
  y: number;
  z: number;
  npcTemplateID: number;
}

export interface MobDetail extends MobSummary {
  suffix: string;
  guild: string;
  model: number;
  size: number;
  speed: number;
  heading: number;
  strength: number;
  constitution: number;
  dexterity: number;
  quickness: number;
  intelligence: number;
  piety: number;
  empathy: number;
  charisma: number;
  race: number;
  gender: number;
  flags: number;
  aggroLevel: number;
  aggroRange: number;
  meleeDamageType: number;
  respawnInterval: number;
  roamingRange: number;
  factionID: number;
  bodyType: number;
  houseNumber: number;
  brain: string;
  pathID: string;
  ownerID: string;
  equipmentTemplateID: string;
  itemsListTemplateID: string;
  visibleWeaponSlots: number;
  isCloakHoodUp: boolean;
  packageID: string;
  classType: string;
}

const SUMMARY_COLUMNS = "Mob_ID, Name, Level, Realm, Region, X, Y, Z, NPCTemplateID";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Suffix, Guild, Model, Size, Speed, Heading, Strength, Constitution, Dexterity, Quickness, " +
  "Intelligence, Piety, Empathy, Charisma, Race, Gender, Flags, AggroLevel, AggroRange, " +
  "MeleeDamageType, RespawnInterval, RoamingRange, FactionID, BodyType, HouseNumber, Brain, " +
  "PathID, OwnerID, EquipmentTemplateID, ItemsListTemplateID, VisibleWeaponSlots, IsCloakHoodUp, " +
  "PackageID, ClassType";

export function buildSearchMobsQuery(params: { q?: string; limit: number; offset: number }): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM Mob WHERE Name LIKE ? OR Guild LIKE ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM Mob ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetMobQuery(id: string): Sql {
  return { text: `SELECT ${DETAIL_COLUMNS} FROM Mob WHERE Mob_ID = ? LIMIT 1`, values: [id] };
}

interface MobRow extends RowDataPacket {
  [key: string]: unknown;
}

const n = (v: unknown): number => Number(v ?? 0);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toSummary(r: MobRow): MobSummary {
  return {
    id: s(r.Mob_ID),
    name: s(r.Name),
    level: n(r.Level),
    realm: n(r.Realm),
    region: n(r.Region),
    x: n(r.X),
    y: n(r.Y),
    z: n(r.Z),
    npcTemplateID: n(r.NPCTemplateID),
  };
}

export async function searchMobs(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<MobSummary[]> {
  const { text, values } = buildSearchMobsQuery(params);
  const [rows] = await gameDb.query<MobRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getMob(id: string): Promise<MobDetail | null> {
  const { text, values } = buildGetMobQuery(id);
  const [rows] = await gameDb.query<MobRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    suffix: s(r.Suffix),
    guild: s(r.Guild),
    model: n(r.Model),
    size: n(r.Size),
    speed: n(r.Speed),
    heading: n(r.Heading),
    strength: n(r.Strength),
    constitution: n(r.Constitution),
    dexterity: n(r.Dexterity),
    quickness: n(r.Quickness),
    intelligence: n(r.Intelligence),
    piety: n(r.Piety),
    empathy: n(r.Empathy),
    charisma: n(r.Charisma),
    race: n(r.Race),
    gender: n(r.Gender),
    flags: n(r.Flags),
    aggroLevel: n(r.AggroLevel),
    aggroRange: n(r.AggroRange),
    meleeDamageType: n(r.MeleeDamageType),
    respawnInterval: n(r.RespawnInterval),
    roamingRange: n(r.RoamingRange),
    factionID: n(r.FactionID),
    bodyType: n(r.BodyType),
    houseNumber: n(r.HouseNumber),
    brain: s(r.Brain),
    pathID: s(r.PathID),
    ownerID: s(r.OwnerID),
    equipmentTemplateID: s(r.EquipmentTemplateID),
    itemsListTemplateID: s(r.ItemsListTemplateID),
    visibleWeaponSlots: n(r.VisibleWeaponSlots),
    isCloakHoodUp: Boolean(r.IsCloakHoodUp),
    packageID: s(r.PackageID),
    classType: s(r.ClassType),
  };
}
