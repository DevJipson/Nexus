import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { hashToken } from "../lib/tokens";
import { readSessionToken } from "../lib/session-cookie";
import { httpError } from "../lib/errors";
import type { SessionService } from "../modules/auth/session.service";
import type { UserRow } from "../types/rows";

/**
 * Request authentication.
 *
 * `requireAuth` resolves the session cookie to a live session + user and
 * attaches them to the request as `req.auth`. Downstream middleware (workspace
 * membership, role checks) reads it. No route trusts a client-supplied identity.
 */

export interface AuthContext {
  user: UserRow;
  sessionId: string;
  /** SHA-256 hash of the current session token (used to preserve the session on password change). */
  tokenHash: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function createRequireAuth(deps: { sessions: SessionService; pool: Pool }) {
  const { sessions, pool } = deps;

  return async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = readSessionToken(req);
      if (!token) throw httpError.unauthenticated();

      const resolved = await sessions.resolve(token);
      if (!resolved) throw httpError.unauthenticated();

      const userResult = await pool.query<UserRow>(
        "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
        [resolved.session.user_id],
      );
      const user = userResult.rows[0];
      if (!user) throw httpError.unauthenticated();

      req.auth = { user, sessionId: resolved.session.id, tokenHash: hashToken(token) };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function currentAuth(req: Request): AuthContext {
  if (!req.auth) throw httpError.unauthenticated();
  return req.auth;
}
