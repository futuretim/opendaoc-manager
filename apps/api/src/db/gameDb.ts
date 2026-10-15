import mysql from "mysql2/promise";
import { config } from "../config.js";

/**
 * Connection pool to the EXTERNAL OpenDAoC game database.
 *
 * This database is owned by the game server. We read from it and perform
 * narrow, column-scoped writes only (see docs/MVP_SPEC.md §5, §8). We never
 * migrate or alter its schema.
 */
export const gameDb = mysql.createPool({
  host: config.GAME_DB_HOST,
  port: config.GAME_DB_PORT,
  user: config.GAME_DB_USER,
  password: config.GAME_DB_PASSWORD,
  database: config.GAME_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Keep dates as strings so the API controls formatting/serialization.
  dateStrings: true,
});

/** Returns true if the game DB answered a trivial query. */
export async function pingGameDb(): Promise<boolean> {
  const conn = await gameDb.getConnection();
  try {
    await conn.query("SELECT 1");
    return true;
  } finally {
    conn.release();
  }
}
