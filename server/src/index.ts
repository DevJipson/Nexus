import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { getEnv } from "./config/env";
import { createDatabasePool } from "./db/pool";
import { createLogger } from "./lib/logger";
import { createSocketServer } from "./sockets/index";
import { createSessionService } from "./modules/auth/session.service";
import { createWorkspaceService } from "./modules/workspaces/workspaces.service";
import { createConversationService } from "./modules/conversations/conversations.service";
import { createEmailTransport } from "./lib/mail";

const env = getEnv();
const logger = createLogger(env);
const pool = createDatabasePool(env, logger);
const email = createEmailTransport(env, logger);

const app = createApp({ env, logger, pool, email });
const server = createServer(app);

const sessions = createSessionService({ pool, logger });
const workspaces = createWorkspaceService({ pool, logger });
const conversations = createConversationService({ pool, workspaces });
const io = createSocketServer(server, { env, logger, pool, sessions, workspaces, conversations });

server.listen(env.port, () => {
  logger.info(
    { port: env.port, origins: env.corsOrigins, env: env.nodeEnv },
    `NEXUS API listening on http://localhost:${env.port}`,
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();

  try {
    // io.close() disconnects sockets AND closes the underlying HTTP server.
    await new Promise<void>((resolve) => io.close(() => resolve()));
    logger.info("http and socket.io servers closed");
  } catch (error) {
    logger.error({ err: error }, "failed to close servers cleanly");
  }

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
