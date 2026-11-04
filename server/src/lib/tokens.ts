import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque token helpers.
 *
 * Session, email-verification and password-reset tokens are 256-bit random
 * values sent to the client as-is. The database stores only their SHA-256
 * hash, so a database leak does not expose usable credentials.
 */

/** A URL-safe random token (43 characters, 256 bits of entropy). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two equally sized hex digests. Used only for
 * defensive comparisons; DB lookups are by hash index, not by scanning.
 */
export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
