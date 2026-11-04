import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "../lib/session-cookie";
import { httpError } from "../lib/errors";
import type { Env } from "../config/env";

/**
 * CSRF protection.
 *
 * The session cookie is SameSite=Lax by default, which blocks cross-site
 * state-changing requests from browsers. As defense in depth (and to cover the
 * cross-site cookie fallback), every unsafe request is also required to carry
 * either a matching Origin/Referer or the custom `X-Requested-With` header that
 * a cross-site form cannot set.
 *
 * This is intentionally in addition to CORS, which only governs whether the
 * *browser* exposes the response — it is not an authorization boundary.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createCsrfProtection(env: Env) {
  const allowedOrigins = new Set(env.corsOrigins);

  return function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // Only cookie-authenticated requests can be forged cross-site; a request
    // without a session cookie carries no ambient authority to abuse.
    const cookieHeader = req.headers.cookie;
    const hasSessionCookie =
      typeof cookieHeader === "string" && cookieHeader.includes(SESSION_COOKIE_NAME);
    if (!hasSessionCookie) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0) {
      if (allowedOrigins.has(origin)) {
        next();
        return;
      }
      next(httpError.forbidden("Request origin is not allowed."));
      return;
    }

    // No Origin header: allow when the generic fetch marker is present (our
    // API client sets it) or when the Referer matches an allowed origin.
    const requestedWith = req.headers["x-requested-with"];
    if (typeof requestedWith === "string" && requestedWith.toLowerCase() === "nexus") {
      next();
      return;
    }

    const referer = req.headers.referer;
    if (typeof referer === "string") {
      try {
        const refererOrigin = new URL(referer).origin;
        if (allowedOrigins.has(refererOrigin)) {
          next();
          return;
        }
      } catch {
        // fall through to rejection
      }
    }

    next(httpError.forbidden("Request origin could not be verified."));
  };
}
