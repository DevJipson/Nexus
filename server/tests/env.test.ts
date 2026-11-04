import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env";

const BASE_ENV = { DATABASE_URL: "postgres://postgres:postgres@localhost:5432/nexus_test" };

describe("parseEnv", () => {
  it("applies development defaults", () => {
    const env = parseEnv(BASE_ENV);
    expect(env.nodeEnv).toBe("development");
    expect(env.port).toBe(4000);
    expect(env.corsOrigins).toEqual(["http://localhost:3000"]);
    expect(env.logLevel).toBe("info");
    expect(env.isProduction).toBe(false);
    expect(env.isTest).toBe(false);
  });

  it("parses the CORS allowlist as a comma-separated list", () => {
    const env = parseEnv({ ...BASE_ENV, CORS_ORIGINS: " http://localhost:3000 , https://nexus.example.com " });
    expect(env.corsOrigins).toEqual(["http://localhost:3000", "https://nexus.example.com"]);
  });

  it("coerces and bounds PORT", () => {
    expect(parseEnv({ ...BASE_ENV, PORT: "5050" }).port).toBe(5050);
    expect(() => parseEnv({ ...BASE_ENV, PORT: "not-a-port" })).toThrow(/Invalid environment/);
    expect(() => parseEnv({ ...BASE_ENV, PORT: "99999" })).toThrow(/Invalid environment/);
  });

  it("rejects unknown NODE_ENV values", () => {
    expect(() => parseEnv({ ...BASE_ENV, NODE_ENV: "staging" })).toThrow(/Invalid environment/);
  });

  it("rejects unknown LOG_LEVEL values", () => {
    expect(() => parseEnv({ ...BASE_ENV, LOG_LEVEL: "loud" })).toThrow(/Invalid environment/);
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("flags production and test modes", () => {
    expect(parseEnv({ ...BASE_ENV, NODE_ENV: "production" }).isProduction).toBe(true);
    expect(parseEnv({ ...BASE_ENV, NODE_ENV: "test" }).isTest).toBe(true);
  });
});
