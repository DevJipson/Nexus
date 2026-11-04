import type { NextFunction, Request, RequestHandler, Response } from "express";
import { httpError } from "../lib/errors";
import type { Env } from "../config/env";

/**
 * Fixed-window in-memory rate limiter.
 *
 * Adequate for a single Node instance. A multi-instance deployment must move
 * the counter to Redis (the same boundary noted for presence / scale-out).
 * Keying is by client IP; `trust proxy` is enabled so Render's forwarded
 * address is used rather than the proxy's.
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  /** Optional custom key derivation (e.g. email for login). */
  keyGenerator?: (req: Request) => string;
}

interface Window {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const { windowMs, max } = options;
  const message = options.message ?? "Too many requests. Try again later.";
  const buckets = new Map<string, Window>();

  // Opportunistic cleanup of expired windows.
  const sweep = (now: number) => {
    if (buckets.size < 5_000) return;
    for (const [key, window] of buckets) {
      if (window.resetAt <= now) buckets.delete(key);
    }
  };

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    sweep(now);
    const key = options.keyGenerator ? options.keyGenerator(req) : req.ip ?? "unknown";
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      next(httpError.rateLimited(message));
      return;
    }
    next();
  };
}

export function createAuthRateLimiters(env: Env) {
  const disabled = env.isTest;
  const passthrough: RequestHandler = (_req, _res, next) => next();

  return {
    login: disabled
      ? passthrough
      : createRateLimiter({ windowMs: 15 * 60_000, max: 10, message: "Too many sign-in attempts. Try again later." }),
    register: disabled
      ? passthrough
      : createRateLimiter({ windowMs: 60 * 60_000, max: 5, message: "Too many sign-ups from this address. Try again later." }),
    forgotPassword: disabled
      ? passthrough
      : createRateLimiter({ windowMs: 60 * 60_000, max: 5, message: "Too many reset requests. Try again later." }),
    resetPassword: disabled
      ? passthrough
      : createRateLimiter({ windowMs: 60 * 60_000, max: 10, message: "Too many reset attempts. Try again later." }),
  };
}
