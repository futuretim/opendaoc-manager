import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

// ---------------------------------------------------------------------------
// Inventory slot ranges (OpenDAoC eInventorySlot, GameServer/gameutils/IGameInventory.cs).
// ---------------------------------------------------------------------------

/** Equipped gear slots (10-37) plus horse gear (7-9). */
export const EQUIPMENT_SLOT_MIN = 7;
export const EQUIPMENT_SLOT_MAX = 37;
/** Personal backpack. */
export const BACKPACK_SLOT_MIN = 40;
export const BACKPACK_SLOT_MAX = 79;
/** Personal vault (slots 110-149), opened at a personal vault keeper. */
export const PERSONAL_VAULT_SLOT_MIN = 110;
export const PERSONAL_VAULT_SLOT_MAX = 149;
/** House vault DB slots (1000-1799), 100 slots per vault, up to 8 vaults. */
export const HOUSE_VAULT_SLOT_MIN = 1000;
export const HOUSE_VAULT_SLOT_MAX = 1799;
/** Account vault DB slots (2500-2699): vault 0 = 2500-2599, vault 1 = 2600-2699. */
export const ACCOUNT_VAULT_SLOT_MIN = 2500;
export const ACCOUNT_VAULT_SLOT_MAX = 2699;
export const ACCOUNT_VAULTS = 2;
export const VAULT_SIZE = 100;

/** Money pseudo-slots stored as inventory rows (client 1.78+). */
export const MONEY_SLOT_MIN = 500;
export const MONEY_SLOT_MAX = 504;

export type InventoryScope = "character" | "guild" | "account";

export interface InventoryItem {
  inventoryId: string;
  ownerId: string;
  slotPosition: number;
  count: number;
  itemTemplateId: string | null;
  itemUniqueId: string | null;
  name: string;
  level: number;
  quality: number;
  objectType: number;
  itemType: number;
  dpsAf: number;
  spdAbs: number;
  weight: number;
  model: number;
  color: number;
  emblem: number;
  condition: number;
  durability: number;
  maxCondition: number;
  maxDurability: number;
  isStackable: boolean;
  maxCount: number;
  price: number;
  sellPrice: number;
  isCrafted: boolean;
  creator: string | null;
  charges: number;
  maxCharges: number;
  description: string;
  realm: number;
}

export interface InventoryPage {
  scope: InventoryScope;
  ownerId: string;
  items: InventoryItem[];
}

// ---------------------------------------------------------------------------
// Query builders (pure - unit-testable without a database connection).
// ---------------------------------------------------------------------------

const ITEM_COLUMNS = `
  i.Inventory_ID, i.OwnerID, i.SlotPosition, i.Count,
  i.ITemplate_Id, i.UTemplate_Id, i.SellPrice,
  i.Color, i.Emblem, i.Condition, i.Durability,
  i.Charges, i.MaxCharges, i.IsCrafted, i.Creator,
  t.Name, t.Level, t.Quality, t.Object_Type, t.Item_Type,
  t.DPS_AF, t.SPD_ABS, t.Weight, t.Model,
  t.MaxCondition, t.MaxDurability, t.IsStackable, t.MaxCount,
  t.Price, t.Description, t.Realm
`;

const ITEM_JOIN =
  "LEFT JOIN ItemTemplate t ON t.Id_nb = COALESCE(i.UTemplate_Id, i.ITemplate_Id)";

/** Character inventory: equipment + backpack + personal vault + money pseudo-slots. */
export function buildCharacterInventoryQuery(ownerId: string): Sql {
  return {
    text:
      `SELECT ${ITEM_COLUMNS} FROM Inventory i ${ITEM_JOIN} ` +
      `WHERE i.OwnerID = ? AND ` +
      `((i.SlotPosition >= ? AND i.SlotPosition <= ?) OR ` +
      `(i.SlotPosition >= ? AND i.SlotPosition <= ?) OR ` +
      `(i.SlotPosition >= ? AND i.SlotPosition <= ?) OR ` +
      `(i.SlotPosition >= ? AND i.SlotPosition <= ?)) ` +
      `ORDER BY i.SlotPosition ASC`,
    values: [
      ownerId,
      EQUIPMENT_SLOT_MIN,
      EQUIPMENT_SLOT_MAX,
      BACKPACK_SLOT_MIN,
      BACKPACK_SLOT_MAX,
      PERSONAL_VAULT_SLOT_MIN,
      PERSONAL_VAULT_SLOT_MAX,
      MONEY_SLOT_MIN,
      MONEY_SLOT_MAX,
    ],
  };
}

/** Guild vault: house-vault DB slots (1000-1799) owned by the guild's GuildID. */
export function buildGuildInventoryQuery(guildId: string): Sql {
  return {
    text:
      `SELECT ${ITEM_COLUMNS} FROM Inventory i ${ITEM_JOIN} ` +
      `WHERE i.OwnerID = ? AND i.SlotPosition >= ? AND i.SlotPosition <= ? ` +
      `ORDER BY i.SlotPosition ASC`,
    values: [guildId, HOUSE_VAULT_SLOT_MIN, HOUSE_VAULT_SLOT_MAX],
  };
}

/**
 * Account vault: DB slots 2500-2699 owned by `{accountName}_{realm}`.
 * The account vault has two pages of 100 slots each (vault index 0 and 1).
 */
export function buildAccountInventoryQuery(accountName: string, realm: number): Sql {
  return {
    text:
      `SELECT ${ITEM_COLUMNS} FROM Inventory i ${ITEM_JOIN} ` +
      `WHERE i.OwnerID = ? AND i.SlotPosition >= ? AND i.SlotPosition <= ? ` +
      `ORDER BY i.SlotPosition ASC`,
    values: [
      `${accountName}_${realm}`,
      ACCOUNT_VAULT_SLOT_MIN,
      ACCOUNT_VAULT_SLOT_MAX,
    ],
  };
}

export function buildGetInventoryItemQuery(inventoryId: string): Sql {
  return {
    text:
      `SELECT ${ITEM_COLUMNS} FROM Inventory i ${ITEM_JOIN} ` +
      `WHERE i.Inventory_ID = ? LIMIT 1`,
    values: [inventoryId],
  };
}

const UPDATABLE_INVENTORY_FIELDS = {
  slotPosition: "SlotPosition",
  count: "Count",
  sellPrice: "SellPrice",
  color: "Color",
  emblem: "Emblem",
  condition: "Condition",
  durability: "Durability",
  charges: "Charges",
} as const;

export type UpdatableInventoryField = keyof typeof UPDATABLE_INVENTORY_FIELDS;

export function buildUpdateInventoryItemQuery(
  inventoryId: string,
  updates: Partial<Record<UpdatableInventoryField, unknown>>,
): Sql {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE_INVENTORY_FIELDS)) {
    const field = key as UpdatableInventoryField;
    if (!(field in updates)) continue;
    sets.push(`${column} = ?`);
    values.push(updates[field]);
  }
  if (sets.length === 0) {
    throw new Error("No updatable fields provided");
  }
  values.push(inventoryId);
  return {
    text: `UPDATE Inventory SET ${sets.join(", ")} WHERE Inventory_ID = ?`,
    values,
  };
}

export function buildDeleteInventoryItemQuery(inventoryId: string): Sql {
  return {
    text: "DELETE FROM Inventory WHERE Inventory_ID = ?",
    values: [inventoryId],
  };
}

/** Check whether a slot is already occupied for the given owner. */
export function buildSlotOccupiedQuery(ownerId: string, slotPosition: number): Sql {
  return {
    text: "SELECT Inventory_ID FROM Inventory WHERE OwnerID = ? AND SlotPosition = ? LIMIT 1",
    values: [ownerId, slotPosition],
  };
}

/** Check whether an item template exists (used before granting items). */
export function buildItemTemplateExistsQuery(idNb: string): Sql {
  return {
    text: "SELECT Id_nb FROM ItemTemplate WHERE Id_nb = ? LIMIT 1",
    values: [idNb],
  };
}

/**
 * Insert a new inventory row from an ItemTemplate. Generates a unique
 * Inventory_ID and initializes condition/durability/charges from the
 * template defaults.
 */
export function buildGrantInventoryItemQuery(params: {
  inventoryId: string;
  ownerId: string;
  slotPosition: number;
  itemTemplateId: string;
  count: number;
  sellPrice: number;
}): Sql {
  return {
    text:
      "INSERT INTO Inventory " +
      "(Inventory_ID, OwnerID, OwnerLot, ITemplate_Id, UTemplate_Id, IsCrafted, Creator, " +
      " SlotPosition, Count, SellPrice, Experience, Color, Emblem, Extension, " +
      " Condition, Durability, PoisonSpellID, PoisonMaxCharges, PoisonCharges, " +
      " Charges, Charges1, Cooldown, LastTimeRowUpdated, IsROG, SalvageExtension) " +
      "SELECT ?, ?, 0, ?, NULL, 0, '', ?, ?, ?, 0, 0, " +
      " t.Color, t.Emblem, t.Extension, t.MaxCondition, t.MaxDurability, 0, 0, 0, " +
      " CASE WHEN t.Charges > 0 THEN t.Charges ELSE t.MaxCharges END, " +
      " CASE WHEN t.Charges1 > 0 THEN t.Charges1 ELSE t.MaxCharges1 END, 0, NOW(), 0, t.SalvageExtension " +
      "FROM ItemTemplate t WHERE t.Id_nb = ?",
    values: [
      params.inventoryId,
      params.ownerId,
      params.itemTemplateId,
      params.slotPosition,
      params.count,
      params.sellPrice,
      params.itemTemplateId,
    ],
  };
}

// ---------------------------------------------------------------------------
// Row mapping + data access.
// ---------------------------------------------------------------------------

interface InventoryRow extends RowDataPacket {
  Inventory_ID: string;
  OwnerID: string;
  SlotPosition: number;
  Count: number;
  ITemplate_Id: string | null;
  UTemplate_Id: string | null;
  SellPrice: number;
  Color: number;
  Emblem: number;
  Condition: number;
  Durability: number;
  Charges: number;
  MaxCharges: number;
  IsCrafted: number | boolean;
  Creator: string | null;
  Name: string | null;
  Level: number | null;
  Quality: number | null;
  Object_Type: number | null;
  Item_Type: number | null;
  DPS_AF: number | null;
  SPD_ABS: number | null;
  Weight: number | null;
  Model: number | null;
  MaxCondition: number | null;
  MaxDurability: number | null;
  IsStackable: number | boolean | null;
  MaxCount: number | null;
  Price: number | null;
  Description: string | null;
  Realm: number | null;
}

const n = (v: unknown): number => Number(v ?? 0);
const s = (v: unknown): string => (v == null ? "" : String(v));

function toItem(r: InventoryRow): InventoryItem {
  return {
    inventoryId: s(r.Inventory_ID),
    ownerId: s(r.OwnerID),
    slotPosition: n(r.SlotPosition),
    count: n(r.Count),
    itemTemplateId: r.ITemplate_Id ?? null,
    itemUniqueId: r.UTemplate_Id ?? null,
    name: s(r.Name) || s(r.ITemplate_Id) || s(r.UTemplate_Id) || "(unknown)",
    level: n(r.Level),
    quality: n(r.Quality),
    objectType: n(r.Object_Type),
    itemType: n(r.Item_Type),
    dpsAf: n(r.DPS_AF),
    spdAbs: n(r.SPD_ABS),
    weight: n(r.Weight),
    model: n(r.Model),
    color: n(r.Color),
    emblem: n(r.Emblem),
    condition: n(r.Condition),
    durability: n(r.Durability),
    maxCondition: n(r.MaxCondition),
    maxDurability: n(r.MaxDurability),
    isStackable: Boolean(r.IsStackable),
    maxCount: n(r.MaxCount),
    price: n(r.Price),
    sellPrice: n(r.SellPrice),
    isCrafted: Boolean(r.IsCrafted),
    creator: r.Creator ?? null,
    charges: n(r.Charges),
    maxCharges: n(r.MaxCharges),
    description: s(r.Description),
    realm: n(r.Realm),
  };
}

async function queryItems(q: Sql): Promise<InventoryItem[]> {
  const [rows] = await gameDb.query<InventoryRow[]>(q.text, q.values);
  return rows.map(toItem);
}

export async function getCharacterInventory(ownerId: string): Promise<InventoryItem[]> {
  return queryItems(buildCharacterInventoryQuery(ownerId));
}

export async function getGuildInventory(guildId: string): Promise<InventoryItem[]> {
  return queryItems(buildGuildInventoryQuery(guildId));
}

export async function getAccountInventory(
  accountName: string,
  realm: number,
): Promise<InventoryItem[]> {
  return queryItems(buildAccountInventoryQuery(accountName, realm));
}

export async function getInventoryItem(inventoryId: string): Promise<InventoryItem | null> {
  const [rows] = await gameDb.query<InventoryRow[]>(
    buildGetInventoryItemQuery(inventoryId).text,
    buildGetInventoryItemQuery(inventoryId).values,
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function updateInventoryItem(
  inventoryId: string,
  updates: Partial<Record<UpdatableInventoryField, unknown>>,
): Promise<boolean> {
  const { text, values } = buildUpdateInventoryItemQuery(inventoryId, updates);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

export async function deleteInventoryItem(inventoryId: string): Promise<boolean> {
  const { text, values } = buildDeleteInventoryItemQuery(inventoryId);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

export async function isSlotOccupied(ownerId: string, slotPosition: number): Promise<boolean> {
  const { text, values } = buildSlotOccupiedQuery(ownerId, slotPosition);
  const [rows] = await gameDb.query<RowDataPacket[]>(text, values);
  return rows.length > 0;
}

export async function itemTemplateExists(idNb: string): Promise<boolean> {
  const { text, values } = buildItemTemplateExistsQuery(idNb);
  const [rows] = await gameDb.query<RowDataPacket[]>(text, values);
  return rows.length > 0;
}

export async function grantInventoryItem(params: {
  inventoryId: string;
  ownerId: string;
  slotPosition: number;
  itemTemplateId: string;
  count: number;
  sellPrice: number;
}): Promise<boolean> {
  const { text, values } = buildGrantInventoryItemQuery(params);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}

/** Generate a unique Inventory_ID (timestamp + random suffix). */
export function generateInventoryId(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Describe a slot range for UI grouping. */
export function slotGroupName(slot: number): string {
  if (slot >= MONEY_SLOT_MIN && slot <= MONEY_SLOT_MAX) return "Money";
  if (slot >= EQUIPMENT_SLOT_MIN && slot <= EQUIPMENT_SLOT_MAX) return "Equipped";
  if (slot >= BACKPACK_SLOT_MIN && slot <= BACKPACK_SLOT_MAX) return "Backpack";
  if (slot >= PERSONAL_VAULT_SLOT_MIN && slot <= PERSONAL_VAULT_SLOT_MAX) return "Personal Vault";
  if (slot >= HOUSE_VAULT_SLOT_MIN && slot <= HOUSE_VAULT_SLOT_MAX) return "Guild Vault";
  if (slot >= ACCOUNT_VAULT_SLOT_MIN && slot <= ACCOUNT_VAULT_SLOT_MAX) return "Account Vault";
  return "Other";
}
