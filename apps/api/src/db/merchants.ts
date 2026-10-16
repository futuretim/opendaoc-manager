import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface MerchantListSummary {
  id: string;
  entries: number;
}

export interface MerchantEntry {
  itemTemplateID: string;
  itemName: string | null;
  pageNumber: number;
  slotPosition: number;
}

export interface MerchantListDetail {
  id: string;
  entries: MerchantEntry[];
}

export function buildListMerchantListsQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ItemListID, COUNT(*) AS entries FROM MerchantItem ` +
        `WHERE ItemListID LIKE ? OR ItemTemplateID LIKE ? ` +
        `GROUP BY ItemListID ORDER BY ItemListID ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text:
      `SELECT ItemListID, COUNT(*) AS entries FROM MerchantItem ` +
      `GROUP BY ItemListID ORDER BY ItemListID ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildMerchantEntriesQuery(itemListID: string): Sql {
  return {
    text:
      `SELECT mi.ItemTemplateID, it.Name AS ItemName, mi.PageNumber, mi.SlotPosition ` +
      `FROM MerchantItem mi LEFT JOIN ItemTemplate it ON it.Id_nb = mi.ItemTemplateID ` +
      `WHERE mi.ItemListID = ? ORDER BY mi.PageNumber ASC, mi.SlotPosition ASC`,
    values: [itemListID],
  };
}

interface SummaryRow extends RowDataPacket {
  ItemListID: string;
  entries: number;
}
interface EntryRow extends RowDataPacket {
  ItemTemplateID: string;
  ItemName: string | null;
  PageNumber: number;
  SlotPosition: number;
}

export async function listMerchantLists(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<MerchantListSummary[]> {
  const { text, values } = buildListMerchantListsQuery(params);
  const [rows] = await gameDb.query<SummaryRow[]>(text, values);
  return rows.map((r) => ({ id: r.ItemListID, entries: Number(r.entries) }));
}

export async function getMerchantList(itemListID: string): Promise<MerchantListDetail | null> {
  const { text, values } = buildMerchantEntriesQuery(itemListID);
  const [rows] = await gameDb.query<EntryRow[]>(text, values);
  if (rows.length === 0) return null;
  return {
    id: itemListID,
    entries: rows.map((r) => ({
      itemTemplateID: r.ItemTemplateID,
      itemName: r.ItemName,
      pageNumber: Number(r.PageNumber),
      slotPosition: Number(r.SlotPosition),
    })),
  };
}
