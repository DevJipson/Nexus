import { Router } from "express";
import type { Pool } from "pg";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import type { EmailTransport } from "../lib/mail";
import type { CookiePolicy } from "../lib/session-cookie";
import { createRequireAuth } from "../middleware/auth";
import { createAuthRateLimiters } from "../middleware/rate-limit";
import { createServices } from "./registry";
import { createAuthRoutes } from "./auth/auth.routes";
import { createUserRoutes } from "./users/users.routes";
import { createWorkspaceRoutes } from "./workspaces/workspaces.routes";
import { createInvitationRoutes } from "./invitations/invitations.routes";
import { createProjectRoutes } from "./projects/projects.routes";
import { createTaskRoutes } from "./tasks/tasks.routes";
import { createEventRoutes } from "./events/events.routes";
import { createFeedRoutes } from "./notifications/feeds.routes";
import { createConversationRoutes } from "./conversations/conversations.routes";

/**
 * Builds the /api/v1 router. Service wiring lives in the registry; middleware
 * (auth, rate limiting) is created here and shared across route factories.
 */
export function createApiRouter(deps: { pool: Pool; env: Env; logger: Logger; email: EmailTransport }): Router {
  const { pool, env, logger, email } = deps;

  const services = createServices({ pool, env, logger, email });
  const requireAuth = createRequireAuth({ sessions: services.sessions, pool });
  const rateLimiters = createAuthRateLimiters(env);

  const cookiePolicy: CookiePolicy = {
    domain: env.cookieDomain,
    secure: env.isProduction || env.cookieSameSite === "none",
    sameSite: env.cookieSameSite,
  };

  const router = Router();

  router.use("/auth", createAuthRoutes({ ...services, requireAuth, rateLimiters, cookiePolicy }));
  router.use(createUserRoutes({ ...services, requireAuth }));
  router.use(createWorkspaceRoutes({ ...services, requireAuth }));
  router.use(createInvitationRoutes({ ...services, requireAuth }));
  router.use(createProjectRoutes({ ...services, requireAuth }));
  router.use(createTaskRoutes({ ...services, requireAuth }));
  router.use(createEventRoutes({ ...services, requireAuth }));
  router.use(createFeedRoutes({ ...services, requireAuth }));
  router.use(createConversationRoutes({ ...services, requireAuth }));

  return router;
}
