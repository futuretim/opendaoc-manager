import type { RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface LootTemplateSummary {
  name: string;
  entries: number;
}

export interface LootEntry {
  itemTemplateID: string;
  itemName: string | null;
  chance: number;
  count: number;
}

export interface LootMobRef {
  mobName: string;
  dropCount: number;
}

export interface LootTemplateDetail {
  name: string;
  entries: LootEntry[];
  mobs: LootMobRef[];
}

export function buildListLootTemplatesQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT TemplateName, COUNT(*) AS entries FROM LootTemplate ` +
        `WHERE TemplateName LIKE ? OR ItemTemplateID LIKE ? ` +
        `GROUP BY TemplateName ORDER BY TemplateName ASC LIMIT ? OFFSET ?`,
      values: [like, like, limit, offset],
    };
  }
  return {
    text:
      `SELECT TemplateName, COUNT(*) AS entries FROM LootTemplate ` +
      `GROUP BY TemplateName ORDER BY TemplateName ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildLootEntriesQuery(templateName: string): Sql {
  return {
    text:
      `SELECT lt.ItemTemplateID, it.Name AS ItemName, lt.Chance, lt.Count ` +
      `FROM LootTemplate lt LEFT JOIN ItemTemplate it ON it.Id_nb = lt.ItemTemplateID ` +
      `WHERE lt.TemplateName = ? ORDER BY lt.Chance DESC, lt.ItemTemplateID ASC`,
    values: [templateName],
  };
}

export function buildMobsForLootTemplateQuery(templateName: string): Sql {
  return {
    text:
      `SELECT MobName, DropCount FROM MobXLootTemplate ` +
      `WHERE LootTemplateName = ? ORDER BY MobName ASC`,
    values: [templateName],
  };
}

interface SummaryRow extends RowDataPacket {
  TemplateName: string;
  entries: number;
}
interface EntryRow extends RowDataPacket {
  ItemTemplateID: string;
  ItemName: string | null;
  Chance: number;
  Count: number;
}
interface MobRow extends RowDataPacket {
  MobName: string;
  DropCount: number;
}

export async function listLootTemplates(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<LootTemplateSummary[]> {
  const { text, values } = buildListLootTemplatesQuery(params);
  const [rows] = await gameDb.query<SummaryRow[]>(text, values);
  return rows.map((r) => ({ name: r.TemplateName, entries: Number(r.entries) }));
}

export async function getLootTemplate(name: string): Promise<LootTemplateDetail | null> {
  const entriesQ = buildLootEntriesQuery(name);
  const mobsQ = buildMobsForLootTemplateQuery(name);
  const [[entryRows], [mobRows]] = await Promise.all([
    gameDb.query<EntryRow[]>(entriesQ.text, entriesQ.values),
    gameDb.query<MobRow[]>(mobsQ.text, mobsQ.values),
  ]);
  if (entryRows.length === 0 && mobRows.length === 0) return null;
  return {
    name,
    entries: entryRows.map((r) => ({
      itemTemplateID: r.ItemTemplateID,
      itemName: r.ItemName,
      chance: Number(r.Chance),
      count: Number(r.Count),
    })),
    mobs: mobRows.map((r) => ({ mobName: r.MobName, dropCount: Number(r.DropCount) })),
  };
}
