import { Router } from "express";
import type { Pool } from "pg";
import { toErrorBody } from "../lib/errors";
import { sendData } from "../lib/http";

/**
 * Infrastructure probes (intentionally outside /api/v1):
 * - /healthz — liveness; no database access.
 * - /readyz  — readiness; verifies a database round-trip.
 */
export function healthRoutes(pool: Pool, startedAt: number): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    sendData(res, 200, {
      status: "ok",
      service: "nexus-api",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/readyz", (_req, res) => {
    pool
      .query("SELECT 1")
      .then(() => {
        sendData(res, 200, { status: "ok", database: "up" });
      })
      .catch(() => {
        res.status(503).json(toErrorBody("UNAVAILABLE", "Database is unavailable."));
      });
  });

  return router;
}
