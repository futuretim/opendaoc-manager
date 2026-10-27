import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface ItemSummary {
  idNb: string;
  name: string;
  level: number;
  realm: number;
  objectType: number;
  itemType: number;
  quality: number;
  dpsAf: number;
  spdAbs: number;
}

export interface ItemDetail extends ItemSummary {
  description: string;
  model: number;
  weight: number;
  hand: number;
  typeDamage: number;
  bonus: number;
  bonusLevel: number;
  extraBonus: number;
  extraBonusType: number;
  durability: number;
  maxDurability: number;
  condition: number;
  maxCondition: number;
  isIndestructible: boolean;
  isNotLosingDur: boolean;
  isPickable: boolean;
  isDropable: boolean;
  canDropAsLoot: boolean;
  isTradable: boolean;
  isStackable: boolean;
  maxCount: number;
  packSize: number;
  price: number;
  levelRequirement: number;
  allowedClasses: string;
  flags: number;
  color: number;
  emblem: number;
  effect: number;
  charges: number;
  maxCharges: number;
  charges1: number;
  maxCharges1: number;
  canUseEvery: number;
  poisonSpellID: number;
  poisonCharges: number;
  poisonMaxCharges: number;
  packageID: string;
  classType: string;
  salvageYieldID: number;
}

const SUMMARY_COLUMNS =
  "Id_nb, Name, Level, Realm, Object_Type, Item_Type, Quality, DPS_AF, SPD_ABS";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Description, Model, Weight, Hand, Type_Damage, Bonus, BonusLevel, ExtraBonus, ExtraBonusType, " +
  "Durability, MaxDurability, `Condition`, MaxCondition, IsIndestructible, IsNotLosingDur, " +
  "IsPickable, IsDropable, CanDropAsLoot, IsTradable, (MaxCount > 1) AS IsStackable, MaxCount, PackSize, Price, " +
  "LevelRequirement, AllowedClasses, Flags, Color, Emblem, Effect, Charges, MaxCharges, " +
  "Charges1, MaxCharges1, CanUseEvery, PoisonSpellID, PoisonCharges, PoisonMaxCharges, " +
  "PackageID, ClassType, SalvageYieldID";

export function buildSearchItemsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${SUMMARY_COLUMNS} FROM ItemTemplate ` +
        `WHERE Name LIKE ? OR Id_nb LIKE ? ` +
        `ORDER BY Name ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${SUMMARY_COLUMNS} FROM ItemTemplate ORDER BY Name ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetItemQuery(idNb: string): Sql {
  return { text: `SELECT ${DETAIL_COLUMNS} FROM ItemTemplate WHERE Id_nb = ? LIMIT 1`, values: [idNb] };
}

interface ItemRow extends RowDataPacket {
  [key: string]: unknown;
}

const n = (v: unknown): number => Number(v ?? 0);
const b = (v: unknown): boolean => Boolean(v);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toSummary(r: ItemRow): ItemSummary {
  return {
    idNb: s(r.Id_nb),
    name: s(r.Name),
    level: n(r.Level),
    realm: n(r.Realm),
    objectType: n(r.Object_Type),
    itemType: n(r.Item_Type),
    quality: n(r.Quality),
    dpsAf: n(r.DPS_AF),
    spdAbs: n(r.SPD_ABS),
  };
}

export async function searchItems(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<ItemSummary[]> {
  const { text, values } = buildSearchItemsQuery(params);
  const [rows] = await gameDb.query<ItemRow[]>(text, values);
  return rows.map(toSummary);
}

export async function getItem(idNb: string): Promise<ItemDetail | null> {
  const { text, values } = buildGetItemQuery(idNb);
  const [rows] = await gameDb.query<ItemRow[]>(text, values);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toSummary(r),
    description: s(r.Description),
    model: n(r.Model),
    weight: n(r.Weight),
    hand: n(r.Hand),
    typeDamage: n(r.Type_Damage),
    bonus: n(r.Bonus),
    bonusLevel: n(r.BonusLevel),
    extraBonus: n(r.ExtraBonus),
    extraBonusType: n(r.ExtraBonusType),
    durability: n(r.Durability),
    maxDurability: n(r.MaxDurability),
    condition: n(r.Condition),
    maxCondition: n(r.MaxCondition),
    isIndestructible: b(r.IsIndestructible),
    isNotLosingDur: b(r.IsNotLosingDur),
    isPickable: b(r.IsPickable),
    isDropable: b(r.IsDropable),
    canDropAsLoot: b(r.CanDropAsLoot),
    isTradable: b(r.IsTradable),
    isStackable: b(r.IsStackable),
    maxCount: n(r.MaxCount),
    packSize: n(r.PackSize),
    price: n(r.Price),
    levelRequirement: n(r.LevelRequirement),
    allowedClasses: s(r.AllowedClasses),
    flags: n(r.Flags),
    color: n(r.Color),
    emblem: n(r.Emblem),
    effect: n(r.Effect),
    charges: n(r.Charges),
    maxCharges: n(r.MaxCharges),
    charges1: n(r.Charges1),
    maxCharges1: n(r.MaxCharges1),
    canUseEvery: n(r.CanUseEvery),
    poisonSpellID: n(r.PoisonSpellID),
    poisonCharges: n(r.PoisonCharges),
    poisonMaxCharges: n(r.PoisonMaxCharges),
    packageID: s(r.PackageID),
    classType: s(r.ClassType),
    salvageYieldID: n(r.SalvageYieldID),
  };
}
