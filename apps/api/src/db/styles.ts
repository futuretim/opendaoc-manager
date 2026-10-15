import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface StyleSummary {
  styleID: number;
  name: string;
  classId: number;
  specKeyName: string;
  specLevelRequirement: number;
}

export interface StyleDetail extends StyleSummary {
  icon: number;
  enduranceCost: number;
  stealthRequirement: boolean;
  openingRequirementType: number;
  openingRequirementValue: number;
  attackResultRequirement: number;
  weaponTypeRequirement: number;
  growthOffset: number;
  growthRate: number;
  bonusToHit: number;
  bonusToDefense: number;
  twoHandAnimation: number;
  randomProc: boolean;
  armorHitLocation: number;
}

const SUMMARY_COLUMNS = "StyleID, Name, ClassId, SpecKeyName, SpecLevelRequirement";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Icon, EnduranceCost, StealthRequirement, OpeningRequirementType, OpeningRequirementValue, " +
  "AttackResultRequirement, WeaponTypeRequirement, GrowthOffset, GrowthRate, BonusToHit, " +
  "BonusToDefense, TwoHandAnimation, RandomProc, ArmorHitLocation";

export function buildSearchStylesQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM Style WHERE Name LIKE ? OR SpecKeyName LIKE ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM Style ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetStyleQuery(styleID: number): Sql {
  return { text: `SELECT ${DETAIL_COLUMNS} FROM Style WHERE StyleID = ? LIMIT 1`, values: [styleID] };
}

interface StyleRow extends RowDataPacket {
  [key: string]: unknown;
}

const n = (v: unknown): number => Number(v ?? 0);
const b = (v: unknown): boolean => Boolean(v);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toSummary(r: StyleRow): StyleSummary {
  return {
    styleID: n(r.StyleID),
    name: s(r.Name),
    classId: n(r.ClassId),
    specKeyName: s(r.SpecKeyName),
    specLevelRequirement: n(r.SpecLevelRequirement),
  };
}

export async function searchStyles(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<StyleSummary[]> {
  const { text, values } = buildSearchStylesQuery(params);
  const [rows] = await gameDb.query<StyleRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getStyle(styleID: number): Promise<StyleDetail | null> {
  const { text, values } = buildGetStyleQuery(styleID);
  const [rows] = await gameDb.query<StyleRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    icon: n(r.Icon),
    enduranceCost: n(r.EnduranceCost),
    stealthRequirement: b(r.StealthRequirement),
    openingRequirementType: n(r.OpeningRequirementType),
    openingRequirementValue: n(r.OpeningRequirementValue),
    attackResultRequirement: n(r.AttackResultRequirement),
    weaponTypeRequirement: n(r.WeaponTypeRequirement),
    growthOffset: n(r.GrowthOffset),
    growthRate: n(r.GrowthRate),
    bonusToHit: n(r.BonusToHit),
    bonusToDefense: n(r.BonusToDefense),
    twoHandAnimation: n(r.TwoHandAnimation),
    randomProc: b(r.RandomProc),
    armorHitLocation: n(r.ArmorHitLocation),
  };
}
