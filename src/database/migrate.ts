import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { logger } from "../config/logger.js";
import { pool } from "./pool.js";

const migrationsDirectory = path.resolve("database/migrations");

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const migration = await client.query<{ filename: string }>(
        "SELECT filename FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (migration.rowCount !== 0) {
        continue;
      }

      const sql = await readFile(
        path.join(migrationsDirectory, filename),
        "utf8",
      );

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(filename) VALUES ($1)",
          [filename],
        );
        await client.query("COMMIT");
        logger.info({ filename }, "Migration applied");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  logger.fatal({ error }, "Migration failed");
  process.exitCode = 1;
});
