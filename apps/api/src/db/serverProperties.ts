import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { gameDb } from "./gameDb.js";
import type { Sql } from "./accounts.js";

export interface ServerProperty {
  key: string;
  category: string;
  description: string;
  defaultValue: string;
  value: string;
}

// `Key` is a reserved word in MySQL and must always be backtick-escaped.
const COLUMNS = "Category, `Key`, Description, DefaultValue, Value";

export function buildListServerPropertiesQuery(params: {
  q?: string;
  limit: number;
  offset: number;
}): Sql {
  const { q, limit, offset } = params;
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    return {
      text:
        `SELECT ${COLUMNS} FROM ServerProperty ` +
        "WHERE `Key` LIKE ? OR Description LIKE ? OR Category LIKE ? " +
        "ORDER BY Category ASC, `Key` ASC LIMIT ? OFFSET ?",
      values: [like, like, like, limit, offset],
    };
  }
  return {
    text: `SELECT ${COLUMNS} FROM ServerProperty ORDER BY Category ASC, \`Key\` ASC LIMIT ? OFFSET ?`,
    values: [limit, offset],
  };
}

export function buildGetServerPropertyQuery(key: string): Sql {
  return { text: `SELECT ${COLUMNS} FROM ServerProperty WHERE \`Key\` = ? LIMIT 1`, values: [key] };
}

export function buildUpdateServerPropertyQuery(key: string, value: string): Sql {
  return { text: "UPDATE ServerProperty SET Value = ? WHERE `Key` = ?", values: [value, key] };
}

interface Row extends RowDataPacket {
  Category: string;
  Key: string;
  Description: string;
  DefaultValue: string;
  Value: string;
}

function toProperty(r: Row): ServerProperty {
  return {
    key: r.Key,
    category: r.Category,
    description: r.Description,
    defaultValue: r.DefaultValue,
    value: r.Value,
  };
}

export async function listServerProperties(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<ServerProperty[]> {
  const { text, values } = buildListServerPropertiesQuery(params);
  const [rows] = await gameDb.query<Row[]>(text, values);
  return rows.map(toProperty);
}

export async function getServerProperty(key: string): Promise<ServerProperty | null> {
  const { text, values } = buildGetServerPropertyQuery(key);
  const [rows] = await gameDb.query<Row[]>(text, values);
  const r = rows[0];
  return r ? toProperty(r) : null;
}

export async function updateServerPropertyValue(key: string, value: string): Promise<boolean> {
  const { text, values } = buildUpdateServerPropertyQuery(key, value);
  const [res] = await gameDb.query<ResultSetHeader>(text, values);
  return res.affectedRows > 0;
}
