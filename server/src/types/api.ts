import type { WorkspaceRole, Presence, Priority, ProjectStatus, TaskStatus } from "./domain";

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

/* ----------------------------- Phase 3: work ----------------------------- */

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  colorHue: number;
  startDate: string;
  dueDate: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubtaskDto {
  id: string;
  title: string;
  done: boolean;
  order: number;
}

export interface CommentDto {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDto {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface TaskDto {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  labels: string[];
  order: number;
  subtasks: SubtaskDto[];
  comments: CommentDto[];
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CalendarEventDto {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  type: "meeting" | "deadline" | "milestone" | "focus";
  projectId: string | null;
  start: string;
  end: string;
  allDay: boolean;
  attendeeIds: string[];
  location: string;
  createdAt: string;
}

export interface ActivityDto {
  id: string;
  workspaceId: string;
  actorId: string;
  kind: string;
  entityType: "project" | "task" | "event" | "member" | "comment";
  entityId: string;
  entityLabel: string;
  projectId: string | null;
  createdAt: string;
}

export interface LabelDto {
  id: string;
  name: string;
  hue: number;
}

/** Task statistics mirroring the frontend `TaskStats` selector shape. */
export interface TaskStatsDto {
  total: number;
  done: number;
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completionRate: number;
}

export interface NotificationDto {
  id: string;
  workspaceId: string;
  category: "task" | "project" | "team" | "mention" | "system";
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}
