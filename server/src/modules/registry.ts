import type { Pool } from "pg";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import type { EmailTransport } from "../lib/mail";
import { createSessionService, type SessionService } from "./auth/session.service";
import { createAuthService, type AuthService } from "./auth/auth.service";
import { createWorkspaceService, type WorkspaceService } from "./workspaces/workspaces.service";
import { createUserService, type UserService } from "./users/users.service";
import { createInvitationService, type InvitationService } from "./invitations/invitations.service";

/**
 * Composition root. Instantiates every service exactly once and shares them so
 * modules never construct their own dependencies (and tests can override any
 * subset).
 */
export interface Services {
  sessions: SessionService;
  auth: AuthService;
  workspaces: WorkspaceService;
  users: UserService;
  invitations: InvitationService;
}

export function createServices(input: {
  pool: Pool;
  env: Env;
  logger: Logger;
  email: EmailTransport;
}): Services {
  const { pool, env, logger, email } = input;

  const sessions = createSessionService({ pool, logger });
  const workspaces = createWorkspaceService({ pool, logger });
  const users = createUserService({ pool, logger });
  const auth = createAuthService({ pool, env, logger, sessions, email });
  const invitations = createInvitationService({ pool, env, logger, email, workspaces });

  return { sessions, auth, workspaces, users, invitations };
}
