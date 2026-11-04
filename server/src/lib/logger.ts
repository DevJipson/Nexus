import pino from "pino";
import type { Env } from "../config/env";

export type Logger = pino.Logger;

export function createLogger(env: Env): Logger {
  return pino({
    level: env.logLevel,
    base: { service: "nexus-api", env: env.nodeEnv },
    redact: {
      // Never log credentials or session material.
      paths: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.token"],
      remove: true,
    },
  });
}
