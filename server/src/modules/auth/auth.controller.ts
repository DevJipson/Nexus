import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { httpError } from "../../lib/errors";
import type { AuthService } from "./auth.service";
import type { SessionService } from "./session.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import type { UserService } from "../users/users.service";
import { toPreferencesDto, toUserDto } from "../users/users.serializer";
import { clearSessionCookie, readSessionToken, setSessionCookie, type CookiePolicy } from "../../lib/session-cookie";
import { hashToken } from "../../lib/tokens";
import { currentAuth } from "../../middleware/auth";
import type { LoginBody, RegisterBody } from "./auth.schemas";

/**
 * Auth controllers. Each handler is thin: validate (middleware) → service →
 * envelope. Cookie writes live here because they are HTTP concerns.
 */

export interface AuthControllerDeps {
  auth: AuthService;
  sessions: SessionService;
  workspaces: WorkspaceService;
  users: UserService;
  cookiePolicy: CookiePolicy;
}

export function createAuthController(deps: AuthControllerDeps) {
  const { auth, sessions, workspaces, users, cookiePolicy } = deps;

  return {
    async register(req: Request, res: Response): Promise<void> {
      const result = await auth.register(req.body as RegisterBody);
      sendData(res, 201, {
        user: toUserDto(result.user),
        emailVerificationRequired: result.verificationRequired,
      });
    },

    async login(req: Request, res: Response): Promise<void> {
      const result = await auth.login(req.body as LoginBody, {
        userAgent: req.headers["user-agent"] ?? null,
        ip: req.ip ?? null,
      });
      setSessionCookie(
        res,
        {
          token: result.token,
          tokenHash: hashToken(result.token),
          expiresAt: result.expiresAt,
        },
        cookiePolicy,
      );
      sendData(res, 200, { user: toUserDto(result.user) });
    },

    async logout(req: Request, res: Response): Promise<void> {
      const token = readSessionToken(req);
      if (token) await sessions.revoke(token);
      clearSessionCookie(res, cookiePolicy);
      sendData(res, 200, { ok: true });
    },

    async me(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const workspaceList = await workspaces.listForUser(user.id);
      sendData(res, 200, { user: toUserDto(user), workspaces: workspaceList });
    },

    async verifyEmail(req: Request, res: Response): Promise<void> {
      const user = await auth.verifyEmail((req.body as { token: string }).token);
      sendData(res, 200, { user: toUserDto(user) });
    },

    async resendVerification(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      if (user.email_verified_at !== null) {
        throw httpError.conflict("Your email is already verified.");
      }
      await auth.requestEmailVerification(user);
      sendData(res, 200, { ok: true });
    },

    async forgotPassword(req: Request, res: Response): Promise<void> {
      await auth.requestPasswordReset((req.body as { email: string }).email);
      // Always 200 — never reveal whether the account exists.
      sendData(res, 200, { ok: true });
    },

    async resetPassword(req: Request, res: Response): Promise<void> {
      const body = req.body as { token: string; password: string };
      await auth.resetPassword(body.token, body.password);
      clearSessionCookie(res, cookiePolicy);
      sendData(res, 200, { ok: true });
    },

    async changePassword(req: Request, res: Response): Promise<void> {
      const { user, tokenHash } = currentAuth(req);
      const body = req.body as { currentPassword: string; newPassword: string };
      await auth.changePassword(user, body.currentPassword, body.newPassword, tokenHash);
      sendData(res, 200, { ok: true });
    },

    /** Lighter session check than /auth/me; useful for the frontend guard. */
    async session(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const preferences = await users.getPreferences(user.id);
      sendData(res, 200, { user: toUserDto(user), preferences: toPreferencesDto(preferences) });
    },
  };
}
