import "dotenv/config";
import { createApp } from "./app";
import { getEnv } from "./config/env";
import { createDatabasePool } from "./db/pool";
import { createLogger } from "./lib/logger";

const env = getEnv();
const logger = createLogger(env);
const pool = createDatabasePool(env, logger);
const app = createApp({ env, logger, pool });

const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, origins: env.corsOrigins, env: env.nodeEnv },
    `NEXUS API listening on http://localhost:${env.port}`,
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  // Force-exit if graceful close stalls (long-lived sockets, etc.).
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();

  server.close(() => logger.info("http server closed"));
  try {
    await pool.end();
    logger.info("database pool closed");
  } catch (error) {
    logger.error({ err: error }, "failed to close database pool cleanly");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
