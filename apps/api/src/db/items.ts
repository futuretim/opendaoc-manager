import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export type ItemFieldKind = "int" | "long" | "bool" | "string";

export interface ItemField {
  key: string; // camelCase request/response key
  column: string; // DB column (plain; reserved words escaped at build time)
  kind: ItemFieldKind;
  group: string; // UI grouping
}

/**
 * Single source of truth for editable ItemTemplate columns, shared by the
 * update builder, the create builder, and request validation. Id_nb (the PK)
 * is handled separately — it is required and immutable after creation.
 */
export const ITEM_FIELDS: ItemField[] = [
  { key: "name", column: "Name", kind: "string", group: "General" },
  { key: "description", column: "Description", kind: "string", group: "General" },
  { key: "examineArticle", column: "ExamineArticle", kind: "string", group: "General" },
  { key: "messageArticle", column: "MessageArticle", kind: "string", group: "General" },
  { key: "level", column: "Level", kind: "int", group: "General" },
  { key: "realm", column: "Realm", kind: "int", group: "General" },
  { key: "quality", column: "Quality", kind: "int", group: "General" },
  { key: "model", column: "Model", kind: "int", group: "General" },
  { key: "objectType", column: "Object_Type", kind: "int", group: "General" },
  { key: "itemType", column: "Item_Type", kind: "int", group: "General" },
  { key: "weight", column: "Weight", kind: "int", group: "General" },
  { key: "price", column: "Price", kind: "long", group: "General" },
  { key: "dpsAf", column: "DPS_AF", kind: "int", group: "Combat" },
  { key: "spdAbs", column: "SPD_ABS", kind: "int", group: "Combat" },
  { key: "hand", column: "Hand", kind: "int", group: "Combat" },
  { key: "typeDamage", column: "Type_Damage", kind: "int", group: "Combat" },
  { key: "bonus", column: "Bonus", kind: "int", group: "Combat" },
  { key: "bonusLevel", column: "BonusLevel", kind: "int", group: "Combat" },
  { key: "extraBonus", column: "ExtraBonus", kind: "int", group: "Combat" },
  { key: "extraBonusType", column: "ExtraBonusType", kind: "int", group: "Combat" },
  { key: "durability", column: "Durability", kind: "int", group: "Durability" },
  { key: "maxDurability", column: "MaxDurability", kind: "int", group: "Durability" },
  { key: "condition", column: "Condition", kind: "int", group: "Durability" },
  { key: "maxCondition", column: "MaxCondition", kind: "int", group: "Durability" },
  { key: "isIndestructible", column: "IsIndestructible", kind: "bool", group: "Durability" },
  { key: "isNotLosingDur", column: "IsNotLosingDur", kind: "bool", group: "Durability" },
  { key: "isPickable", column: "IsPickable", kind: "bool", group: "Flags" },
  { key: "isDropable", column: "IsDropable", kind: "bool", group: "Flags" },
  { key: "canDropAsLoot", column: "CanDropAsLoot", kind: "bool", group: "Flags" },
  { key: "isTradable", column: "IsTradable", kind: "bool", group: "Flags" },
  { key: "isStackable", column: "IsStackable", kind: "bool", group: "Flags" },
  { key: "maxCount", column: "MaxCount", kind: "int", group: "Flags" },
  { key: "packSize", column: "PackSize", kind: "int", group: "Flags" },
  { key: "flags", column: "Flags", kind: "int", group: "Flags" },
  { key: "allowUpdate", column: "AllowUpdate", kind: "bool", group: "Flags" },
  { key: "levelRequirement", column: "LevelRequirement", kind: "int", group: "Requirements" },
  { key: "allowedClasses", column: "AllowedClasses", kind: "string", group: "Requirements" },
  { key: "effect", column: "Effect", kind: "int", group: "Charges" },
  { key: "charges", column: "Charges", kind: "int", group: "Charges" },
  { key: "maxCharges", column: "MaxCharges", kind: "int", group: "Charges" },
  { key: "charges1", column: "Charges1", kind: "int", group: "Charges" },
  { key: "maxCharges1", column: "MaxCharges1", kind: "int", group: "Charges" },
  { key: "canUseEvery", column: "CanUseEvery", kind: "int", group: "Charges" },
  { key: "poisonSpellID", column: "PoisonSpellID", kind: "int", group: "Charges" },
  { key: "poisonCharges", column: "PoisonCharges", kind: "int", group: "Charges" },
  { key: "poisonMaxCharges", column: "PoisonMaxCharges", kind: "int", group: "Charges" },
  { key: "color", column: "Color", kind: "int", group: "Appearance" },
  { key: "emblem", column: "Emblem", kind: "int", group: "Appearance" },
  { key: "packageID", column: "PackageID", kind: "string", group: "Appearance" },
  { key: "classType", column: "ClassType", kind: "string", group: "Appearance" },
  { key: "salvageYieldID", column: "SalvageYieldID", kind: "int", group: "Appearance" },
];

// NOT NULL columns not exposed in the form — defaulted on create so inserts
// never violate constraints.
const CREATE_EXTRA_DEFAULTS: { column: string; value: unknown }[] = [
  { column: "TranslationId", value: "" },
  { column: "SalvageExtension", value: 0 },
  { column: "Extension", value: 0 },
];

const RESERVED = new Set(["Condition", "Range", "Key"]);
const esc = (col: string): string => (RESERVED.has(col) ? `\`${col}\`` : col);

function coerce(kind: ItemFieldKind, value: unknown): unknown {
  if (kind === "bool") return value ? 1 : 0;
  if (kind === "int" || kind === "long") return Number(value ?? 0);
  return value == null ? "" : String(value);
}

function defaultFor(kind: ItemFieldKind): unknown {
  return kind === "string" ? "" : 0;
}

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
  examineArticle: string;
  messageArticle: string;
  allowUpdate: boolean;
}

const SUMMARY_COLUMNS =
  "Id_nb, Name, Level, Realm, Object_Type, Item_Type, Quality, DPS_AF, SPD_ABS";
const DETAIL_COLUMNS =
  SUMMARY_COLUMNS +
  ", Description, Model, Weight, Hand, Type_Damage, Bonus, BonusLevel, ExtraBonus, ExtraBonusType, " +
  "Durability, MaxDurability, `Condition`, MaxCondition, IsIndestructible, IsNotLosingDur, " +
  "IsPickable, IsDropable, CanDropAsLoot, IsTradable, IsStackable, MaxCount, PackSize, Price, " +
  "LevelRequirement, AllowedClasses, Flags, Color, Emblem, Effect, Charges, MaxCharges, " +
  "Charges1, MaxCharges1, CanUseEvery, PoisonSpellID, PoisonCharges, PoisonMaxCharges, " +
  "PackageID, ClassType, SalvageYieldID, ExamineArticle, MessageArticle, AllowUpdate";

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

export function buildUpdateItemQuery(
  idNb: string,
  updates: Record<string, unknown>,
): Sql {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of ITEM_FIELDS) {
    if (!(f.key in updates)) continue;
    sets.push(`${esc(f.column)} = ?`);
    values.push(coerce(f.kind, updates[f.key]));
  }
  if (sets.length === 0) throw new Error("No updatable fields provided");
  values.push(idNb);
  return { text: `UPDATE ItemTemplate SET ${sets.join(", ")} WHERE Id_nb = ?`, values };
}

export function buildCreateItemQuery(idNb: string, values: Record<string, unknown>): Sql {
  const columns = ["Id_nb"];
  const params: unknown[] = [idNb];
  for (const f of ITEM_FIELDS) {
    columns.push(esc(f.column));
    params.push(f.key in values ? coerce(f.kind, values[f.key]) : defaultFor(f.kind));
  }
  for (const extra of CREATE_EXTRA_DEFAULTS) {
    columns.push(esc(extra.column));
    params.push(extra.value);
  }
  const placeholders = columns.map(() => "?").join(", ");
  return {
    text: `INSERT INTO ItemTemplate (${columns.join(", ")}) VALUES (${placeholders})`,
    values: params,
  };
}

export async function updateItem(idNb: string, updates: Record<string, unknown>): Promise<boolean> {
  const { text, values } = buildUpdateItemQuery(idNb, updates);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

export async function createItem(idNb: string, values: Record<string, unknown>): Promise<void> {
  const { text, values: params } = buildCreateItemQuery(idNb, values);
  await gameDb.query<ResultSetHeader>(text, params);
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
    examineArticle: s(r.ExamineArticle),
    messageArticle: s(r.MessageArticle),
    allowUpdate: b(r.AllowUpdate),
  };
}
