import { randomUUID } from "node:crypto";
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
/** Horse saddlebags (FirstBagHorse-LastBagHorse). */
export const HORSE_BAG_SLOT_MIN = 80;
export const HORSE_BAG_SLOT_MAX = 95;
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

// Money is NOT stored in Inventory: OpenDAoC keeps it in the DOLCharacters
// Copper/Silver/Gold/Platinum/Mithril columns (see characters.ts).

export type InventoryScope = "character" | "guild" | "account";

type SlotRange = readonly [min: number, max: number];

/** Slot ranges each scope lists. */
export const SCOPE_SLOT_RANGES: Record<InventoryScope, readonly SlotRange[]> = {
  character: [
    [EQUIPMENT_SLOT_MIN, EQUIPMENT_SLOT_MAX],
    [BACKPACK_SLOT_MIN, BACKPACK_SLOT_MAX],
    [HORSE_BAG_SLOT_MIN, HORSE_BAG_SLOT_MAX],
    [PERSONAL_VAULT_SLOT_MIN, PERSONAL_VAULT_SLOT_MAX],
  ],
  guild: [[HOUSE_VAULT_SLOT_MIN, HOUSE_VAULT_SLOT_MAX]],
  account: [[ACCOUNT_VAULT_SLOT_MIN, ACCOUNT_VAULT_SLOT_MAX]],
};

/**
 * Slot ranges an item may be placed into (grant or move). Equipment slots are
 * excluded: the game validates item type per equipment slot and the console
 * doesn't, so staff can only put items into bags and vaults. Moving an
 * equipped item OUT to a bag is allowed.
 */
export const WRITABLE_SLOT_RANGES: Record<InventoryScope, readonly SlotRange[]> = {
  character: SCOPE_SLOT_RANGES.character.filter(([min]) => min !== EQUIPMENT_SLOT_MIN),
  guild: SCOPE_SLOT_RANGES.guild,
  account: SCOPE_SLOT_RANGES.account,
};

const inRanges = (slot: number, ranges: readonly SlotRange[]): boolean =>
  ranges.some(([min, max]) => slot >= min && slot <= max);

/** The scope a slot belongs to, or null for slots the console doesn't manage. */
export function scopeForSlot(slot: number): InventoryScope | null {
  for (const scope of Object.keys(SCOPE_SLOT_RANGES) as InventoryScope[]) {
    if (inRanges(slot, SCOPE_SLOT_RANGES[scope])) return scope;
  }
  return null;
}

/** Whether an item may be granted or moved into `slot` within `scope`. */
export function isWritableSlot(scope: InventoryScope, slot: number): boolean {
  return inRanges(slot, WRITABLE_SLOT_RANGES[scope]);
}

/** OpenDAoC eRealm names; the account vault owner ID uses the enum name. */
const REALM_ENUM_NAMES: Record<number, string> = { 1: "Albion", 2: "Midgard", 3: "Hibernia" };

/**
 * Account vault owner ID, as OpenDAoC's AccountVaultKeeper.BuildOwnerId builds
 * it: `$"{Account.Name}_{player.Realm}"`, where Realm is the eRealm enum, so
 * the suffix is the realm NAME (`Alice_Albion`), not its number.
 */
export function accountVaultOwnerId(accountName: string, realm: number): string {
  const realmName = REALM_ENUM_NAMES[realm];
  if (!realmName) throw new Error(`Unknown realm ${realm}`);
  return `${accountName}_${realmName}`;
}

/** Inverse of accountVaultOwnerId: the account name, or null if not a vault owner ID. */
export function accountNameFromVaultOwnerId(ownerId: string): string | null {
  const m = /^(.+)_(Albion|Midgard|Hibernia)$/.exec(ownerId);
  return m ? m[1]! : null;
}

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

// An Inventory row points at either a shared ItemTemplate (ITemplate_Id) or a
// per-item ItemUnique row (UTemplate_Id: crafted, generated and most looted
// items), and both tables have the same item columns, so each template column
// is read from whichever one matched.
const TEMPLATE_COLUMNS = [
  "Name", "Level", "Quality", "Object_Type", "Item_Type", "DPS_AF", "SPD_ABS", "Weight",
  "Model", "MaxCondition", "MaxDurability", "MaxCharges", "MaxCount", "Price",
  "Description", "Realm",
];

// Condition is a reserved word in MariaDB/MySQL; it only works unquoted when
// table-qualified (i.Condition). Unqualified uses must be backtick-quoted.
// Neither template table has IsStackable: OpenDAoC derives it as MaxCount > 1.
const ITEM_COLUMNS = [
  "i.Inventory_ID, i.OwnerID, i.SlotPosition, i.Count",
  "i.ITemplate_Id, i.UTemplate_Id, i.SellPrice",
  "i.Color, i.Emblem, i.Condition, i.Durability",
  "i.Charges, i.IsCrafted, i.Creator",
  ...TEMPLATE_COLUMNS.map((c) => `COALESCE(u.${c}, t.${c}) AS ${c}`),
  "(COALESCE(u.MaxCount, t.MaxCount) > 1) AS IsStackable",
].join(", ");

const ITEM_JOIN =
  "LEFT JOIN ItemUnique u ON u.Id_nb = i.UTemplate_Id " +
  "LEFT JOIN ItemTemplate t ON t.Id_nb = i.ITemplate_Id";

function buildScopeInventoryQuery(ownerId: string, scope: InventoryScope): Sql {
  const ranges = SCOPE_SLOT_RANGES[scope];
  return {
    text:
      `SELECT ${ITEM_COLUMNS} FROM Inventory i ${ITEM_JOIN} ` +
      `WHERE i.OwnerID = ? AND (` +
      ranges.map(() => "(i.SlotPosition >= ? AND i.SlotPosition <= ?)").join(" OR ") +
      `) ORDER BY i.SlotPosition ASC`,
    values: [ownerId, ...ranges.flat()],
  };
}

/** Character inventory: equipment + backpack + horse bags + personal vault. */
export function buildCharacterInventoryQuery(ownerId: string): Sql {
  return buildScopeInventoryQuery(ownerId, "character");
}

/** Guild vault: house-vault DB slots (1000-1799) owned by the guild's GuildID. */
export function buildGuildInventoryQuery(guildId: string): Sql {
  return buildScopeInventoryQuery(guildId, "guild");
}

/**
 * Account vault: DB slots 2500-2699 owned by accountVaultOwnerId().
 * The account vault has two pages of 100 slots each (vault index 0 and 1).
 */
export function buildAccountInventoryQuery(accountName: string, realm: number): Sql {
  return buildScopeInventoryQuery(accountVaultOwnerId(accountName, realm), "account");
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
    sets.push(`\`${column}\` = ?`);
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

/** Look up the stacking rules of an item template (used before granting items). */
export function buildItemTemplateStackQuery(idNb: string): Sql {
  return {
    text: "SELECT Id_nb, MaxCount FROM ItemTemplate WHERE Id_nb = ? LIMIT 1",
    values: [idNb],
  };
}

/**
 * Is any player who could be holding this inventory in game memory online?
 * OpenDAoC stamps account.LastLogin on login and LastDisconnected on
 * disconnect, so an account is online while LastLogin is later than
 * LastDisconnected. The owner is matched three ways:
 *   - a character ID (character inventory): that character's account;
 *   - a GuildID (guild vault): any member's account;
 *   - an account vault owner ID: that account (pass its name as accountName).
 */
export function buildOwnerOnlineQuery(ownerId: string, accountName: string | null): Sql {
  return {
    text:
      "SELECT a.Name FROM account a " +
      "WHERE a.LastLogin IS NOT NULL " +
      "AND (a.LastDisconnected IS NULL OR a.LastLogin > a.LastDisconnected) " +
      "AND (a.Name = ? OR a.Name IN " +
      "(SELECT c.AccountName FROM DOLCharacters c WHERE c.DOLCharacters_ID = ? OR c.GuildID = ?)) " +
      "LIMIT 1",
    values: [accountName, ownerId, ownerId],
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
      " `Condition`, Durability, PoisonSpellID, PoisonMaxCharges, PoisonCharges, " +
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
  const { text, values } = buildGetInventoryItemQuery(inventoryId);
  const [rows] = await gameDb.query<InventoryRow[]>(text, values);
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

export interface ItemTemplateStack {
  isStackable: boolean;
  maxCount: number;
}

export async function getItemTemplateStack(idNb: string): Promise<ItemTemplateStack | null> {
  const { text, values } = buildItemTemplateStackQuery(idNb);
  const [rows] = await gameDb.query<RowDataPacket[]>(text, values);
  const r = rows[0];
  return r ? { isStackable: n(r.MaxCount) > 1, maxCount: n(r.MaxCount) } : null;
}

/** Largest valid Count for an item: 1 unless stackable, then the template's MaxCount. */
export function maxStackCount(t: ItemTemplateStack): number {
  return t.isStackable ? Math.max(1, t.maxCount) : 1;
}

export async function isOwnerOnline(ownerId: string): Promise<boolean> {
  const { text, values } = buildOwnerOnlineQuery(ownerId, accountNameFromVaultOwnerId(ownerId));
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

/** Generate a unique Inventory_ID: a GUID, like the game's own rows. */
export function generateInventoryId(): string {
  return randomUUID();
}

/** Describe a slot range for UI grouping. */
export function slotGroupName(slot: number): string {
  if (slot >= EQUIPMENT_SLOT_MIN && slot <= EQUIPMENT_SLOT_MAX) return "Equipped";
  if (slot >= BACKPACK_SLOT_MIN && slot <= BACKPACK_SLOT_MAX) return "Backpack";
  if (slot >= HORSE_BAG_SLOT_MIN && slot <= HORSE_BAG_SLOT_MAX) return "Horse Bags";
  if (slot >= PERSONAL_VAULT_SLOT_MIN && slot <= PERSONAL_VAULT_SLOT_MAX) return "Personal Vault";
  if (slot >= HOUSE_VAULT_SLOT_MIN && slot <= HOUSE_VAULT_SLOT_MAX) return "Guild Vault";
  if (slot >= ACCOUNT_VAULT_SLOT_MIN && slot <= ACCOUNT_VAULT_SLOT_MAX) return "Account Vault";
  return "Other";
}
