import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface NpcTemplateSummary {
  templateId: number;
  name: string;
  level: string;
  model: string;
  race: number;
  classType: string;
}

export interface NpcTemplateDetail extends NpcTemplateSummary {
  suffix: string;
  guildName: string;
  size: string;
  maxSpeed: number;
  factionID: number;
  gender: number;
  flags: number;
  meleeDamageType: number;
  parryChance: number;
  evadeChance: number;
  blockChance: number;
  leftHandSwingChance: number;
  spells: string;
  styles: string;
  abilities: string;
  strength: number;
  constitution: number;
  dexterity: number;
  quickness: number;
  intelligence: number;
  piety: number;
  charisma: number;
  empathy: number;
  aggroLevel: number;
  aggroRange: number;
  bodyType: number;
  maxDistance: number;
  tetherRange: number;
  visibleWeaponSlots: number;
  replaceMobValues: boolean;
  equipmentTemplateID: string;
  itemsListTemplateID: string;
  packageID: string;
}

const SUMMARY_COLUMNS = "TemplateId, Name, Level, Model, Race, ClassType";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Suffix, GuildName, Size, MaxSpeed, FactionID, Gender, Flags, MeleeDamageType, ParryChance, " +
  "EvadeChance, BlockChance, LeftHandSwingChance, Spells, Styles, Abilities, Strength, Constitution, " +
  "Dexterity, Quickness, Intelligence, Piety, Charisma, Empathy, AggroLevel, AggroRange, BodyType, " +
  "MaxDistance, TetherRange, VisibleWeaponSlots, ReplaceMobValues, EquipmentTemplateID, " +
  "ItemsListTemplateID, PackageID";

export function buildSearchNpcTemplatesQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM NpcTemplate WHERE Name LIKE ? OR TemplateId = ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, Number(q.trim()) || -1, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM NpcTemplate ORDER BY TemplateId ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetNpcTemplateQuery(templateId: number): Sql {
  return {
    text: `SELECT ${DETAIL_COLUMNS} FROM NpcTemplate WHERE TemplateId = ? LIMIT 1`,
    values: [templateId],
  };
}

interface NpcRow extends RowDataPacket {
  [key: string]: unknown;
}

const n = (v: unknown): number => Number(v ?? 0);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toSummary(r: NpcRow): NpcTemplateSummary {
  return {
    templateId: n(r.TemplateId),
    name: s(r.Name),
    level: s(r.Level),
    model: s(r.Model),
    race: n(r.Race),
    classType: s(r.ClassType),
  };
}

export async function searchNpcTemplates(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<NpcTemplateSummary[]> {
  const { text, values } = buildSearchNpcTemplatesQuery(params);
  const [rows] = await gameDb.query<NpcRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getNpcTemplate(templateId: number): Promise<NpcTemplateDetail | null> {
  const { text, values } = buildGetNpcTemplateQuery(templateId);
  const [rows] = await gameDb.query<NpcRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    suffix: s(r.Suffix),
    guildName: s(r.GuildName),
    size: s(r.Size),
    maxSpeed: n(r.MaxSpeed),
    factionID: n(r.FactionID),
    gender: n(r.Gender),
    flags: n(r.Flags),
    meleeDamageType: n(r.MeleeDamageType),
    parryChance: n(r.ParryChance),
    evadeChance: n(r.EvadeChance),
    blockChance: n(r.BlockChance),
    leftHandSwingChance: n(r.LeftHandSwingChance),
    spells: s(r.Spells),
    styles: s(r.Styles),
    abilities: s(r.Abilities),
    strength: n(r.Strength),
    constitution: n(r.Constitution),
    dexterity: n(r.Dexterity),
    quickness: n(r.Quickness),
    intelligence: n(r.Intelligence),
    piety: n(r.Piety),
    charisma: n(r.Charisma),
    empathy: n(r.Empathy),
    aggroLevel: n(r.AggroLevel),
    aggroRange: n(r.AggroRange),
    bodyType: n(r.BodyType),
    maxDistance: n(r.MaxDistance),
    tetherRange: n(r.TetherRange),
    visibleWeaponSlots: n(r.VisibleWeaponSlots),
    replaceMobValues: Boolean(r.ReplaceMobValues),
    equipmentTemplateID: s(r.EquipmentTemplateID),
    itemsListTemplateID: s(r.ItemsListTemplateID),
    packageID: s(r.PackageID),
  };
}
