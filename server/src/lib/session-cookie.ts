import type { Request, Response } from "express";
import { generateToken, hashToken } from "./tokens";

/**
 * Session cookie helpers.
 *
 * The cookie carries an opaque random token; the database stores only its hash.
 * Cookie attributes:
 * - HttpOnly always (JavaScript cannot read the token).
 * - Secure in production (and always when SameSite=None).
 * - SameSite=Lax by default — correct when the frontend and API share a
 *   registrable domain (the recommended D2 topology).
 * - SameSite=None (+ Partitioned) only for the cross-site fallback; requires
 *   Secure and still fails on Safari, which is why same-domain is preferred.
 *
 * Cookie policy is injected (never read from global process.env) so tests and
 * multiple environments cannot accidentally share cached configuration.
 */

export const SESSION_COOKIE_NAME = "nexus_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000; // 30 days absolute

export interface CookiePolicy {
  domain?: string;
  secure: boolean;
  sameSite: "lax" | "none";
}

export interface SessionCookieValue {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export function createSessionToken(): SessionCookieValue {
  const token = generateToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

export function setSessionCookie(res: Response, value: SessionCookieValue, policy: CookiePolicy): void {
  res.cookie(SESSION_COOKIE_NAME, value.token, {
    httpOnly: true,
    secure: policy.secure,
    sameSite: policy.sameSite,
    domain: policy.domain,
    path: "/",
    maxAge: SESSION_TTL_MS,
    partitioned: policy.sameSite === "none" ? true : undefined,
  });
}

export function clearSessionCookie(res: Response, policy: CookiePolicy): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: policy.secure,
    sameSite: policy.sameSite,
    domain: policy.domain,
    path: "/",
    partitioned: policy.sameSite === "none" ? true : undefined,
  });
}

export function readSessionToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[SESSION_COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : null;
}
