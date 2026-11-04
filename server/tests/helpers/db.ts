import { randomUUID } from "node:crypto";
import type { Express } from "express";
import pino from "pino";
import { Pool } from "pg";
import request, { type Agent, type SuperTest, type Test } from "supertest";
import { describe } from "vitest";
import { createApp } from "../../src/app";
import { parseEnv, type Env } from "../../src/config/env";
import { resetSchema } from "../../src/db/migrate";
import type { EmailMessage, EmailTransport } from "../../src/lib/mail";

/**
 * Shared helpers for database-backed API suites.
 *
 * These are skipped automatically when TEST_DATABASE_URL is not set, so the
 * unit suites still run in environments without Postgres.
 */
export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
export const describeDb = hasDatabase ? describe : describe.skip;

export const logger = pino({ level: "silent" });

export function testEnv(): Env {
  return parseEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost/none",
    CORS_ORIGINS: "http://localhost:3000",
    APP_BASE_URL: "http://localhost:3000",
  });
}

export function createPool(): Pool {
  return new Pool({ connectionString: process.env.TEST_DATABASE_URL });
}

/** Email transport that records outbound messages for assertions. */
export interface CapturingTransport extends EmailTransport {
  messages: EmailMessage[];
  lastTo(email: string): EmailMessage | undefined;
  clear(): void;
  /** Extracts the first `token=` query parameter from a recorded message. */
  tokenFor(email: string, subjectIncludes?: string): string | undefined;
}

export function createCapturingTransport(): CapturingTransport {
  const messages: EmailMessage[] = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    },
    lastTo(email) {
      return [...messages].reverse().find((message) => message.to === email);
    },
    clear() {
      messages.length = 0;
    },
    tokenFor(email, subjectIncludes) {
      const candidates = [...messages].reverse().filter((message) => message.to === email);
      const match = subjectIncludes
        ? candidates.find((message) => message.subject.toLowerCase().includes(subjectIncludes.toLowerCase()))
        : candidates[0];
      if (!match) return undefined;
      const tokenMatch = /[?&]token=([^&\s]+)/.exec(match.text);
      return tokenMatch ? decodeURIComponent(tokenMatch[1] ?? "") : undefined;
    },
  };
}

export function createTestApp(pool: Pool, env: Env, email: EmailTransport): Express {
  return createApp({ env, logger, pool, email });
}

/**
 * A supertest agent that mimics the real browser API client: it sends the
 * `X-Requested-With: nexus` marker on every request, which the CSRF middleware
 * accepts when no Origin header is present (as in non-browser test runs).
 */
export function api(app: Express): Agent {
  return request.agent(app).set("X-Requested-With", "nexus");
}

export { request };
export type { SuperTest, Test };

/** Resets the schema and returns fresh dependencies. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await resetSchema(pool, logger);
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
}

/** Extracts the first Set-Cookie header value as a non-empty string. */
export function firstCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Expected a Set-Cookie header on the response.");
  }
  return value;
}

/** Small wait helper for timestamp-ordering assertions. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
