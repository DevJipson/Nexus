import { z } from "zod";

/**
 * Environment contract. Parsed once via `getEnv()`; `parseEnv` stays pure so
 * tests can exercise it directly. Database tests use TEST_DATABASE_URL and
 * never read the cached singleton.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // Session cookie / CSRF. Same-site ("lax") is the recommended topology;
  // "none" is the cross-site fallback (see deployment notes).
  SESSION_COOKIE_SAMESITE: z.enum(["lax", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),
  // Absolute session lifetime in days.
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  // Base URL used to build verification / reset links in emails.
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  // Only used by seeds/demo.ts. The seed refuses to run in production.
  DEMO_PASSWORD: z.string().min(8).default("nexus-demo-2026"),
});

export interface Env {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  cookieSameSite: "lax" | "none";
  cookieDomain: string | undefined;
  sessionTtlDays: number;
  appBaseUrl: string;
  demoPassword: string;
  isProduction: boolean;
  isTest: boolean;
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }

  const value = parsed.data;
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    corsOrigins: value.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: value.LOG_LEVEL,
    cookieSameSite: value.SESSION_COOKIE_SAMESITE,
    cookieDomain: value.COOKIE_DOMAIN,
    sessionTtlDays: value.SESSION_TTL_DAYS,
    appBaseUrl: value.APP_BASE_URL.replace(/\/+$/, ""),
    demoPassword: value.DEMO_PASSWORD,
    isProduction: value.NODE_ENV === "production",
    isTest: value.NODE_ENV === "test",
  };
}

let cached: Env | null = null;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test hook: forces the next getEnv() call to re-read process.env. */
export function resetEnvCache(): void {
  cached = null;
}
