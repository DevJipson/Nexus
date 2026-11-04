import type { Pool, PoolClient } from "pg";
import type { Env } from "../../config/env";
import type { Logger } from "../../lib/logger";
import type { EmailTransport } from "../../lib/mail";
import { hashPassword, verifyPassword } from "../../lib/passwords";
import { generateToken, hashToken } from "../../lib/tokens";
import { httpError } from "../../lib/errors";
import type { SessionService } from "./session.service";
import type { UserRow, VerificationTokenRow } from "../../types/rows";
import type { LoginBody, RegisterBody } from "./auth.schemas";

/**
 * Authentication service.
 *
 * Security properties:
 * - Passwords hashed with Argon2id; verification is constant-time inside the
 *   binding.
 * - Login failures return one generic error and a bounded per-account lockout,
 *   so responses never reveal whether an email exists.
 * - Verification / reset tokens are random, stored hashed, single-use and
 *   time-boxed.
 * - A successful password change or reset revokes every other session.
 */

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1_000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1_000;

export interface LoginAttemptState {
  failures: number;
  lockedUntil: number | null;
}

export interface AuthServiceOptions {
  pool: Pool;
  env: Env;
  logger: Logger;
  sessions: SessionService;
  email: EmailTransport;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
  /** Injectable randomness for deterministic failure simulations. */
  random?: () => number;
}

export interface AuthService {
  register(input: RegisterBody): Promise<{ user: UserRow; verificationRequired: boolean }>;
  login(input: LoginBody, context: { userAgent?: string | null; ip?: string | null }): Promise<{ user: UserRow; token: string; expiresAt: Date }>;
  requestEmailVerification(user: UserRow): Promise<void>;
  verifyEmail(token: string): Promise<UserRow>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<UserRow>;
  changePassword(user: UserRow, currentPassword: string, newPassword: string, currentTokenHash?: string): Promise<void>;
  recordFailedLogin(email: string): void;
}

type StoredAttempt = LoginAttemptState;

const MAX_FAILURES = 5;
const BASE_LOCKOUT_MS = 60_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { pool, logger, sessions, email } = options;
  const now = options.now ?? (() => Date.now());
  // Lazily-reset in-memory attempt store (reset after a successful login).
  const attempts = new Map<string, StoredAttempt>();

  function attemptState(emailKey: string): StoredAttempt {
    const existing = attempts.get(emailKey);
    if (existing) {
      if (existing.lockedUntil !== null && existing.lockedUntil <= now()) {
        existing.failures = 0;
        existing.lockedUntil = null;
      }
      return existing;
    }
    const fresh: StoredAttempt = { failures: 0, lockedUntil: null };
    attempts.set(emailKey, fresh);
    return fresh;
  }

  async function loadUserByEmail(db: Pool | PoolClient, emailValue: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL",
      [emailValue],
    );
    return result.rows[0] ?? null;
  }

  async function loadUserById(db: Pool | PoolClient, id: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [id]);
    return result.rows[0] ?? null;
  }

  async function issueToken(
    db: Pool | PoolClient,
    userId: string,
    purpose: "email_verify" | "password_reset",
    ttlMs: number,
  ): Promise<string> {
    const token = generateToken();
    // Invalidate any outstanding token of the same purpose.
    await db.query("UPDATE verification_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [
      userId,
      purpose,
    ]);
    await db.query(
      `INSERT INTO verification_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, purpose, hashToken(token), new Date(now() + ttlMs)],
    );
    return token;
  }

  async function consumeToken(
    purpose: "email_verify" | "password_reset",
    token: string,
  ): Promise<{ tokenRow: VerificationTokenRow; user: UserRow }> {
    const result = await pool.query<VerificationTokenRow>(
      "SELECT * FROM verification_tokens WHERE token_hash = $1 AND purpose = $2",
      [hashToken(token), purpose],
    );
    const tokenRow = result.rows[0];
    if (!tokenRow || tokenRow.used_at !== null || tokenRow.expires_at.getTime() <= now()) {
      throw httpError.validation("This link is invalid or has expired.");
    }
    const user = await loadUserById(pool, tokenRow.user_id);
    if (!user) throw httpError.validation("This link is invalid or has expired.");
    return { tokenRow, user };
  }

  function verificationEmail(name: string, token: string): { subject: string; text: string } {
    const link = `${options.env.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    return {
      subject: "Verify your NEXUS email",
      text: `Hi ${name},\n\nConfirm your email address to finish setting up NEXUS:\n${link}\n\nThis link expires in 24 hours.`,
    };
  }

  function resetEmail(name: string, token: string): { subject: string; text: string } {
    const link = `${options.env.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return {
      subject: "Reset your NEXUS password",
      text: `Hi ${name},\n\nWe received a request to reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request it, you can ignore this email.`,
    };
  }

  return {
    async register(input) {
      const existing = await loadUserByEmail(pool, input.email);
      if (existing) {
        throw httpError.conflict("An account with that email already exists.");
      }

      const passwordHash = await hashPassword(input.password);
      // Deterministic avatar hue from the email, mirroring the frontend system.
      const avatarHue = [...input.email].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 360, 7);

      const user = await pool
        .query<UserRow>(
          `INSERT INTO users (email, password_hash, name, avatar_hue, email_verified_at)
           VALUES ($1, $2, $3, $4, NULL)
           RETURNING *`,
          [input.email, passwordHash, input.name, avatarHue],
        )
        .then((result) => {
          const row = result.rows[0];
          if (!row) throw httpError.internal();
          return row;
        });

      // Preferences row (defaults mirror the frontend).
      await pool.query("INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [user.id]);

      const token = await issueToken(pool, user.id, "email_verify", EMAIL_VERIFY_TTL_MS);
      const message = verificationEmail(user.name, token);
      await email.send({ to: user.email, ...message });
      logger.info({ userId: user.id }, "user registered");

      return { user, verificationRequired: true };
    },

    async login(input, context) {
      const state = attemptState(input.email);
      if (state.lockedUntil !== null && state.lockedUntil > now()) {
        const retrySeconds = Math.ceil((state.lockedUntil - now()) / 1000);
        throw httpError.rateLimited(`Too many attempts. Try again in ${retrySeconds} seconds.`);
      }

      const user = await loadUserByEmail(pool, input.email);
      // Always run a verification to keep timing similar whether the account
      // exists or not. A dummy hash is used for the missing-user case.
      const passwordOk = user
        ? await verifyPassword(user.password_hash, input.password)
        : await verifyPassword(
            "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000",
            input.password,
          ).catch(() => false);

      if (!user || !passwordOk) {
        state.failures += 1;
        if (state.failures >= MAX_FAILURES) {
          const backoff = Math.min(BASE_LOCKOUT_MS * 2 ** (state.failures - MAX_FAILURES), MAX_LOCKOUT_MS);
          state.lockedUntil = now() + backoff;
        }
        throw httpError.unauthenticated("Incorrect email or password.");
      }

      attempts.delete(input.email);

      const session = await sessions.create({
        userId: user.id,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
      });

      await pool.query("UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]).catch(() => undefined);
      return { user, token: session.token, expiresAt: session.expiresAt };
    },

    async requestEmailVerification(user) {
      const token = await issueToken(pool, user.id, "email_verify", EMAIL_VERIFY_TTL_MS);
      await email.send({ to: user.email, ...verificationEmail(user.name, token) });
    },

    async verifyEmail(token) {
      const { tokenRow, user } = await consumeToken("email_verify", token);
      const updated = await pool
        .query<UserRow>(
          "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1 RETURNING *",
          [user.id],
        )
        .then((result) => result.rows[0] ?? user);
      await pool.query("UPDATE verification_tokens SET used_at = now() WHERE id = $1", [tokenRow.id]);
      return updated;
    },

    async requestPasswordReset(emailValue) {
      const user = await loadUserByEmail(pool, emailValue);
      // Always succeed to avoid account enumeration.
      if (!user) {
        logger.debug({ email: emailValue }, "password reset requested for unknown email");
        return;
      }
      const token = await issueToken(pool, user.id, "password_reset", PASSWORD_RESET_TTL_MS);
      await email.send({ to: user.email, ...resetEmail(user.name, token) });
    },

    async resetPassword(token, newPassword) {
      const { tokenRow, user } = await consumeToken("password_reset", token);
      const passwordHash = await hashPassword(newPassword);
      const updated = await pool
        .query<UserRow>(
          "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING *",
          [user.id, passwordHash],
        )
        .then((result) => result.rows[0] ?? user);
      await pool.query("UPDATE verification_tokens SET used_at = now() WHERE id = $1", [tokenRow.id]);
      // A reset revokes every session, including the one that requested it.
      await sessions.revokeAllForUser(user.id);
      return updated;
    },

    async changePassword(user, currentPassword, newPassword, currentTokenHash) {
      const passwordOk = await verifyPassword(user.password_hash, currentPassword);
      if (!passwordOk) throw httpError.unauthenticated("Your current password is incorrect.");
      const passwordHash = await hashPassword(newPassword);
      await pool.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [user.id, passwordHash]);
      // Keep the current session, revoke the rest.
      await sessions.revokeAllForUser(user.id, currentTokenHash);
    },

    recordFailedLogin(emailValue) {
      attemptState(emailValue).failures += 1;
    },
  };
}
