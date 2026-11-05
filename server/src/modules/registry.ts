import type { Pool } from "pg";
import type { Env } from "../config/env";
import type { Logger } from "../lib/logger";
import type { EmailTransport } from "../lib/mail";
import { createSessionService, type SessionService } from "./auth/session.service";
import { createAuthService, type AuthService } from "./auth/auth.service";
import { createWorkspaceService, type WorkspaceService } from "./workspaces/workspaces.service";
import { createUserService, type UserService } from "./users/users.service";
import { createInvitationService, type InvitationService } from "./invitations/invitations.service";
import { createProjectService, type ProjectService } from "./projects/projects.service";
import { createTaskService, type TaskService } from "./tasks/tasks.service";
import { createEventService, type EventService } from "./events/events.service";
import { createFeedService, type FeedService } from "./notifications/feeds.service";
import { createConversationService, type ConversationService } from "./conversations/conversations.service";

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
  projects: ProjectService;
  tasks: TaskService;
  events: EventService;
  feeds: FeedService;
  conversations: ConversationService;
  pool: Pool;
}

export function createServices(input: {
  pool: Pool;
  env: Env;
  logger: Logger;
  email: EmailTransport;
}): Services {
  const { pool: inputPool, env, logger, email } = input;
  const sessions = createSessionService({ pool: inputPool, logger });
  const workspaces = createWorkspaceService({ pool: inputPool, logger });
  const users = createUserService({ pool: inputPool, logger });
  const auth = createAuthService({ pool: inputPool, env, logger, sessions, email });
  const invitations = createInvitationService({ pool: inputPool, env, logger, email, workspaces });
  const projects = createProjectService({ pool: inputPool, logger });
  const tasks = createTaskService({ pool: inputPool, logger, projects });
  const events = createEventService({ pool: inputPool, logger, projects });
  const feeds = createFeedService({ pool: inputPool });
  const conversations = createConversationService({ pool: inputPool, workspaces });

  return { sessions, auth, workspaces, users, invitations, projects, tasks, events, feeds, conversations, pool: inputPool };
}
