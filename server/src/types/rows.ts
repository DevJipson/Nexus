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

export type { Presence };
