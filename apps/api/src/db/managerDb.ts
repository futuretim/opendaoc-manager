import mysql from "mysql2/promise";
import { config } from "../config.js";

/**
 * Connection pool to the Manager's OWN database (staff users, audit log,
 * sessions). This schema is owned by this app and migrated by us
 * (see migrations/). It is kept isolated from the game database.
 */
export const managerDb = mysql.createPool({
  host: config.MANAGER_DB_HOST,
  port: config.MANAGER_DB_PORT,
  user: config.MANAGER_DB_USER,
  password: config.MANAGER_DB_PASSWORD,
  database: config.MANAGER_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true, // used by the migration runner only
  dateStrings: true,
});

export async function pingManagerDb(): Promise<boolean> {
  const conn = await managerDb.getConnection();
  try {
    await conn.query("SELECT 1");
    return true;
  } finally {
    conn.release();
  }
}
