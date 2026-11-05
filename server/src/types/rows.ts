import type { WorkspaceRole, Presence } from "../types/domain";

/**
 * Database row shapes (snake_case) for the tables auth/workspaces touch.
 * Services map these to camelCase DTOs at the HTTP boundary.
 */

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  title: string;
  bio: string;
  location: string;
  timezone: string;
  avatar_hue: number;
  avatar_url: string | null;
  email_verified_at: Date | null;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserPreferencesRow {
  user_id: string;
  density: "comfortable" | "compact";
  reduce_motion: boolean;
  start_of_week: number;
  email_digest: boolean;
  notify_task_assigned: boolean;
  notify_comments_mentions: boolean;
  notify_due_date_reminders: boolean;
  notify_project_updates: boolean;
  active_workspace_id: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface VerificationTokenRow {
  id: string;
  user_id: string;
  purpose: "email_verify" | "password_reset";
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan: "Studio" | "Team" | "Personal";
  description: string;
  accent_hue: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: Date;
}

export interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token_hash: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

/** Joined row used by member directory queries. */
export interface MemberWithRoleRow {
  id: string;
  email: string;
  name: string;
  title: string;
  bio: string;
  location: string;
  timezone: string;
  avatar_hue: number;
  avatar_url: string | null;
  role: WorkspaceRole;
  joined_at: Date;
}

/* ------------------------------ Phase 3 rows ----------------------------- */

import type { Priority, ProjectStatus, TaskStatus } from "./domain";

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  color_hue: number;
  start_date: Date;
  due_date: Date;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/* ----------------------------- Phase 4 rows ----------------------------- */

export interface ConversationRow {
  id: string;
  workspace_id: string;
  kind: "direct" | "group";
  name: string | null;
  project_id: string | null;
  direct_key: string | null;
  created_by: string | null;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationMemberRow {
  conversation_id: string;
  user_id: string;
  last_read_at: Date;
  joined_at: Date;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TaskRow {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee_id: string | null;
  reporter_id: string;
  due_date: Date | null;
  sort_order: number;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: Date;
}

export interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AttachmentRow {
  id: string;
  task_id: string;
  uploaded_by: string;
  name: string;
  size_bytes: string;
  mime_type: string;
  storage_key: string | null;
  uploaded_at: Date;
}

export interface CalendarEventRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string;
  type: "meeting" | "deadline" | "milestone" | "focus";
  start_at: Date;
  end_at: Date;
  all_day: boolean;
  location: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ActivityRow {
  id: string;
  workspace_id: string;
  actor_id: string;
  kind: string;
  entity_type: "project" | "task" | "event" | "member" | "comment";
  entity_id: string;
  entity_label: string;
  project_id: string | null;
  created_at: Date;
}

export interface LabelRow {
  id: string;
  workspace_id: string;
  name: string;
  hue: number;
  created_at: Date;
}

export interface NotificationRow {
  id: string;
  workspace_id: string;
  user_id: string;
  category: "task" | "project" | "team" | "mention" | "system";
  title: string;
  body: string;
  href: string | null;
  read_at: Date | null;
  created_at: Date;
}

export type { Presence };
