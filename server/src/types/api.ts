import type { WorkspaceRole, Presence } from "../types/domain";

/**
 * Wire shapes.
 *
 * These intentionally mirror the frontend's `src/types/domain.ts` field names
 * so the client can consume them with no mapping layer. Timestamps are
 * ISO-8601 UTC strings; IDs are UUID strings.
 */

export interface UserDto {
  id: string;
  email: string;
  name: string;
  title: string;
  bio: string;
  location: string;
  timezone: string;
  avatarHue: number;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesDto {
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  startOfWeek: 0 | 1;
  emailDigest: boolean;
  taskAssigned: boolean;
  commentsMentions: boolean;
  dueDateReminders: boolean;
  projectUpdates: boolean;
}

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  slug: string;
  plan: "Studio" | "Team" | "Personal";
  description: string;
  accentHue: number;
  memberCount: number;
  /** The caller's role in this workspace. */
  role: WorkspaceRole;
}

/**
 * Mirrors the frontend `Member` shape, but scoped to the workspace the request
 * targets: `role` is the caller-target member's role in that workspace and
 * `presence` is sourced from the presence registry (Phase 4). `workspaceIds`
 * collapses to the single workspace in scope.
 */
export interface MemberDto {
  id: string;
  workspaceIds: string[];
  name: string;
  email: string;
  role: WorkspaceRole;
  title: string;
  bio: string;
  presence: Presence;
  timezone: string;
  location: string;
  avatarHue: number;
  joinedAt: string;
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}
