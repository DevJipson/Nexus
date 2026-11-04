import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import type { Logger } from "../lib/logger";

/**
 * Forward-only SQL migration runner.
 *
 * - Migrations are plain `.sql` files in `server/migrations`, named
 *   `NNNN_domain.sql` and applied in lexicographic order.
 * - Each file is applied inside its own transaction; the applied name is
 *   recorded in `schema_migrations` within that same transaction, so a failed
 *   migration never half-applies.
 * - A session-level advisory lock serializes concurrent runners (two deploy
 *   containers racing at boot).
 * - There are no down migrations by design (forward-only is the norm for
 *   plain-SQL flows); `resetSchema` recreates the schema from scratch for
 *   development and tests.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "migrations");
const MIGRATION_LOCK_KEY = 745_231;

export interface MigrationRunResult {
  applied: string[];
  skipped: number;
}

async function ensureMigrationsTable(client: Pick<Pool, "query">): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       text        PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

export async function appliedMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const result = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    return result.rows.map((row) => row.name);
  } finally {
    client.release();
  }
}

export async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((file) => file.endsWith(".sql")).sort();
}

export async function runMigrations(pool: Pool, logger: Logger): Promise<MigrationRunResult> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await ensureMigrationsTable(client);

    const applied = new Set(
      (
        await client.query<{ name: string }>("SELECT name FROM schema_migrations")
      ).rows.map((row) => row.name),
    );
    const files = await listMigrationFiles();
    const pending = files.filter((file) => !applied.has(file));

    const appliedNow: string[] = [];
    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        appliedNow.push(file);
        logger.info({ migration: file }, "migration applied");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${file} failed: ${message}`, { cause: error });
      }
    }

    return { applied: appliedNow, skipped: files.length - appliedNow.length };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

/**
 * Development/test helper: drops and recreates the public schema, then applies
 * every migration. Never call this against a database holding real data.
 */
export async function resetSchema(pool: Pool, logger: Logger): Promise<MigrationRunResult> {
  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    logger.warn("schema dropped and recreated (reset)");
  } finally {
    client.release();
  }
  return runMigrations(pool, logger);
}

/* ------------------------------- CLI entry ------------------------------- */

async function main(): Promise<void> {
  const command = process.argv[2] ?? "up";
  const { getEnv } = await import("../config/env");
  const { createLogger } = await import("../lib/logger");
  const { createDatabasePool } = await import("./pool");

  const env = getEnv();
  const logger = createLogger(env);
  const pool = createDatabasePool(env, logger);

  try {
    if (command === "up") {
      const result = await runMigrations(pool, logger);
      logger.info(
        { applied: result.applied.length, skipped: result.skipped },
        "migrations up to date",
      );
    } else if (command === "reset") {
      if (env.isProduction) {
        throw new Error("Refusing to reset the database schema in production.");
      }
      const result = await resetSchema(pool, logger);
      logger.info(
        { applied: result.applied.length },
        "schema reset; all migrations re-applied",
      );
    } else if (command === "status") {
      const [applied, files] = await Promise.all([appliedMigrations(pool), listMigrationFiles()]);
      const pending = files.filter((file) => !applied.includes(file));
      logger.info(
        { applied: applied.length, pending: pending.length, pendingFiles: pending },
        "migration status",
      );
    } else {
      logger.error({ command }, "unknown command — use: up | reset | status");
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
