import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { managerDb } from "./managerDb.js";
import { logger } from "../logger.js";

/**
 * Minimal forward-only migration runner for the Manager database.
 *
 * Applies every `*.sql` file in ../../migrations in lexical order, tracking
 * which have run in a `_migrations` bookkeeping table. Each file's statements
 * should be idempotent (CREATE TABLE IF NOT EXISTS, etc.) so re-runs are safe.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "..", "migrations");

async function run(): Promise<void> {
  const conn = await managerDb.getConnection();
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS _migrations (
         name VARCHAR(255) NOT NULL PRIMARY KEY,
         applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    const [appliedRows] = await conn.query<any[]>("SELECT name FROM _migrations");
    const applied = new Set(appliedRows.map((r) => r.name as string));

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(migrationsDir, file), "utf8");
      logger.info({ file }, "applying migration");
      await conn.query(sql);
      await conn.query("INSERT INTO _migrations (name) VALUES (?)", [file]);
      count += 1;
    }

    logger.info(
      { applied: count, total: files.length },
      count === 0 ? "no new migrations" : "migrations applied",
    );
  } finally {
    conn.release();
    await managerDb.end();
  }
}

run().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
