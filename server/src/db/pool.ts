import { Pool, type PoolConfig } from "pg";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";

export type { Pool } from "pg";

/**
 * Creates the application pool.
 *
 * - Local development (localhost) connects without SSL; every remote host
 *   (Neon) connects with TLS.
 * - Sizes stay small: Neon's pooled endpoint (PgBouncer, transaction mode)
 *   prefers many short-lived clients over a few long-lived heavy ones.
 * - statement/query timeouts guard against runaway queries.
 *
 * node-postgres uses unnamed prepared statements by default, which is
 * compatible with PgBouncer transaction pooling. Do not pass `name` to
 * `client.query` anywhere in this codebase.
 */
export function createDatabasePool(env: Env, logger?: Logger): Pool {
  const isLocal = /(?:localhost|127\.0\.0\.1|\[::1\]|::1)/.test(env.databaseUrl);

  const config: PoolConfig = {
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  };

  const pool = new Pool(config);

  pool.on("error", (error) => {
    // Idle-client errors would otherwise crash the process (unhandled 'error').
    logger?.error({ err: error }, "unexpected database pool error");
  });

  return pool;
}
