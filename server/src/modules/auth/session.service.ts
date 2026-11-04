import type { Pool, PoolClient } from "pg";
import type { Logger } from "../../lib/logger";
import type { SessionRow } from "../../types/rows";
import { createSessionToken, type SessionCookieValue } from "../../lib/session-cookie";
import { hashToken } from "../../lib/tokens";

/**
 * Server-side sessions.
 *
 * The cookie value is random; only its SHA-256 hash is stored. Sessions carry
 * an absolute expiry and can be revoked (logout, password change/reset).
 */

type Queryable = Pool | PoolClient;

export interface SessionWithUser {
  session: SessionRow;
  user: {
    id: string;
    email: string;
    name: string;
    deleted_at: Date | null;
  };
}

export interface SessionServiceOptions {
  pool: Pool;
  logger: Logger;
  /** Sliding renewal: refresh last_used_at at most once per this window. */
  lastUsedRefreshMs?: number;
}

export interface SessionService {
  create(input: {
    userId: string;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<SessionCookieValue>;
  /** Resolves a cookie token to an active session + user, refreshing usage. */
  resolve(token: string): Promise<SessionWithUser | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<number>;
  deleteExpired(limit?: number): Promise<number>;
}

const DEFAULT_REFRESH_MS = 24 * 60 * 60 * 1_000;

export function createSessionService(options: SessionServiceOptions): SessionService {
  const { pool, logger } = options;
  const refreshMs = options.lastUsedRefreshMs ?? DEFAULT_REFRESH_MS;

  async function insert(
    db: Queryable,
    input: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string | null; ip?: string | null },
  ): Promise<void> {
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.tokenHash, input.expiresAt, input.userAgent ?? null, input.ip ?? null],
    );
  }

  return {
    async create(input) {
      const session = createSessionToken();
      await insert(pool, {
        userId: input.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      });
      return session;
    },

    async resolve(token) {
      const tokenHash = hashToken(token);
      const result = await pool.query<SessionRow & { email: string; name: string; deleted_at: Date | null }>(
        `SELECT s.*, u.email, u.name, u.deleted_at
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;

      if (row.revoked_at !== null) return null;
      if (row.expires_at.getTime() <= Date.now()) return null;
      if (row.deleted_at !== null) return null;

      // Sliding renewal, throttled to avoid a write on every request.
      if (Date.now() - row.last_used_at.getTime() > refreshMs) {
        await pool
          .query("UPDATE sessions SET last_used_at = now() WHERE id = $1", [row.id])
          .catch((error: unknown) => logger.warn({ err: error }, "failed to refresh session last_used_at"));
      }

      const { email, name, deleted_at, ...session } = row;
      return { session, user: { id: session.user_id, email, name, deleted_at } };
    },

    async revoke(token) {
      await pool.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
        hashToken(token),
      ]);
    },

    async revokeAllForUser(userId, exceptTokenHash) {
      const result = exceptTokenHash
        ? await pool.query(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND token_hash <> $2",
            [userId, exceptTokenHash],
          )
        : await pool.query(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            [userId],
          );
      return result.rowCount ?? 0;
    },

    async deleteExpired(limit = 500) {
      const result = await pool.query(
        `DELETE FROM sessions
          WHERE id IN (
            SELECT id FROM sessions
             WHERE expires_at <= now() OR revoked_at IS NOT NULL
             ORDER BY expires_at ASC
             LIMIT $1
          )`,
        [limit],
      );
      return result.rowCount ?? 0;
    },
  };
}
