import request from "supertest";
import type { Express } from "express";
import pino from "pino";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { parseEnv } from "../src/config/env";

const env = parseEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/unused",
  CORS_ORIGINS: "http://localhost:3000",
});
const logger = pino({ level: "silent" });

function stubPool(behavior: "ok" | "fail" = "ok"): Pool {
  const query =
    behavior === "ok"
      ? vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 })
      : vi.fn().mockRejectedValue(new Error("connection refused"));
  return { query } as unknown as Pool;
}

describe("health and app wiring", () => {
  let app: Express;
  let pool: Pool;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /healthz returns the success envelope without touching the database", async () => {
    pool = stubPool();
    app = createApp({ env, logger, pool, startedAt: Date.now() - 5_000 });

    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("nexus-api");
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(5);
    expect(typeof response.body.data.timestamp).toBe("string");
    expect(response.body.error).toBeUndefined();
  });

  it("GET /readyz returns 200 when the database responds", async () => {
    app = createApp({ env, logger, pool: stubPool() });

    const response = await request(app).get("/readyz");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ok", database: "up" });
  });

  it("GET /readyz returns 503 UNAVAILABLE when the database is unreachable", async () => {
    app = createApp({ env, logger, pool: stubPool("fail") });

    const response = await request(app).get("/readyz");
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("UNAVAILABLE");
  });

  it("GET /api/v1 exposes the service banner", async () => {
    app = createApp({ env, logger, pool: stubPool() });

    const response = await request(app).get("/api/v1");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ service: "nexus-api", phase: 2 });
  });

  it("returns the error envelope for unknown routes", async () => {
    app = createApp({ env, logger, pool: stubPool() });

    const response = await request(app).get("/api/v1/definitely-not-a-route");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("responds 400 with VALIDATION_ERROR for a malformed JSON body", async () => {
    app = createApp({ env, logger, pool: stubPool() });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("CORS", () => {
  const app = createApp({ env, logger, pool: stubPool() });

  it("echoes allowlisted origins and allows credentials", async () => {
    const response = await request(app)
      .get("/api/v1")
      .set("Origin", "http://localhost:3000");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("withholds CORS headers for non-allowlisted origins", async () => {
    const response = await request(app)
      .get("/api/v1")
      .set("Origin", "https://evil.example.com");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    // The request itself still succeeds server-side; the browser enforces CORS.
    expect(response.status).toBe(200);
  });

  it("allows preflight requests from allowlisted origins", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
