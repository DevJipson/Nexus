import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import type { IncomingMessage, ServerResponse } from "node:http";
import pinoHttp from "pino-http";
import type { Pool } from "pg";
import type { Env } from "./config/env";
import { createErrorHandler, notFoundHandler } from "./middleware/errors";
import { createCsrfProtection } from "./middleware/csrf";
import type { Logger } from "./lib/logger";
import { createEmailTransport, type EmailTransport } from "./lib/mail";
import { sendData } from "./lib/http";
import { healthRoutes } from "./routes/health";
import { createApiRouter } from "./modules/api-router";

export interface AppDeps {
  env: Env;
  logger: Logger;
  pool: Pool;
  startedAt?: number;
  /** Overridable email transport (tests inject a capturing transport). */
  email?: EmailTransport;
}

function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers["x-request-id"];
  const requestId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
  res.setHeader("X-Request-Id", requestId);
  return requestId;
}

/**
 * Builds the Express application. Dependency-injected (env/logger/pool) so
 * tests can mount it with stubs and no database.
 *
 * Phase 4 will attach Socket.IO to the same HTTP server that hosts this app;
 * the CORS allowlist below is shared with the socket server.
 */
export function createApp(deps: AppDeps): Express {
  const { env, logger, pool } = deps;
  const startedAt = deps.startedAt ?? Date.now();
  const email = deps.email ?? createEmailTransport(env, logger);

  const app = express();

  app.disable("x-powered-by");
  // Render terminates TLS at a proxy; trust the first hop for correct req.ip.
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: assignRequestId,
      autoLogging: {
        ignore: (req) => Boolean(req.url?.startsWith("/healthz")),
      },
      redact: {
        paths: ["req.headers.cookie", "req.headers.authorization"],
        remove: true,
      },
    }),
  );

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (curl, health checks) send no Origin — allow.
        // Disallowed origins get no CORS headers; the browser blocks them.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  // CSRF defense-in-depth for all state-changing requests.
  app.use(createCsrfProtection(env));

  // Service banner — useful for smoke checks of envelope + CORS without auth.
  app.get("/api/v1", (_req: Request, res) => {
    sendData(res, 200, {
      service: "nexus-api",
      version: "0.1.0",
      phase: 2,
      apiNamespace: "/api/v1",
    });
  });

  app.use(healthRoutes(pool, startedAt));
  app.use("/api/v1", createApiRouter({ pool, env, logger, email }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
