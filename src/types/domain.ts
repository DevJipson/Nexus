/**
 * NEXUS domain model.
 *
 * All timestamps are ISO-8601 strings. This is deliberate: the entire dataset
 * is persisted to localStorage as JSON, and `Date` instances do not survive
 * serialization. Convert at the edges through `@/lib/dates`.
 */

export type ID = string;
export type ISODate = string;

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type Presence = "online" | "away" | "offline";

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "archived";

export type Priority = "low" | "medium" | "high" | "urgent";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done";

export type TaskLabel =
  | "design"
  | "frontend"
  | "backend"
  | "research"
  | "bug"
  | "infra"
  | "content"
  | "qa"
  | "growth"
  | "ops";

export type CalendarEventType = "meeting" | "deadline" | "milestone" | "focus";

export type NotificationCategory =
  | "task"
  | "project"
  | "team"
  | "mention"
  | "system";

export type ActivityKind =
  | "project.created"
  | "project.updated"
  | "project.completed"
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.assigned"
  | "comment.created"
  | "event.created"
  | "member.joined";

export interface Workspace {
  id: ID;
  name: string;
  slug: string;
  plan: "Studio" | "Team" | "Personal";
  description: string;
  accentHue: number;
  memberIds: ID[];
  createdAt: ISODate;
}

export interface Member {
  id: ID;
  workspaceIds: ID[];
  name: string;
  email: string;
  role: WorkspaceRole;
  title: string;
  bio: string;
  presence: Presence;
  timezone: string;
  location: string;
  avatarHue: number;
  joinedAt: ISODate;
}

export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  colorHue: number;
  startDate: ISODate;
  dueDate: ISODate;
  memberIds: ID[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Comment {
  id: ID;
  authorId: ID;
  body: string;
  createdAt: ISODate;
}

export interface Attachment {
  id: ID;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: ISODate;
}

export interface Task {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: ID | null;
  reporterId: ID;
  dueDate: ISODate | null;
  labels: TaskLabel[];
  /** Sort position within a kanban column. Fractional to allow cheap insertion. */
  order: number;
  subtasks: Subtask[];
  comments: Comment[];
  attachments: Attachment[];
  createdAt: ISODate;
  updatedAt: ISODate;
  completedAt: ISODate | null;
}

export interface CalendarEvent {
  id: ID;
  workspaceId: ID;
  title: string;
  description: string;
  type: CalendarEventType;
  projectId: ID | null;
  start: ISODate;
  end: ISODate;
  allDay: boolean;
  attendeeIds: ID[];
  location: string;
  createdAt: ISODate;
}

export interface Message {
  id: ID;
  authorId: ID;
  body: string;
  createdAt: ISODate;
}

export interface Conversation {
  id: ID;
  workspaceId: ID;
  kind: "direct" | "group";
  name: string | null;
  participantIds: ID[];
  projectId: ID | null;
  messages: Message[];
  lastReadAt: ISODate;
}

export interface Notification {
  id: ID;
  workspaceId: ID;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  href: string | null;
}

export interface ActivityEntry {
  id: ID;
  workspaceId: ID;
  actorId: ID;
  kind: ActivityKind;
  entityType: "project" | "task" | "event";
  entityId: ID;
  entityLabel: string;
  projectId: ID | null;
  createdAt: ISODate;
}

/** Ephemeral, non-persisted UI state. */
export type TaskView = "board" | "list" | "table";
export type ProjectView = "grid" | "list";
export type CalendarView = "month" | "week" | "day";

export interface TaskFilters {
  search: string;
  assigneeId: ID | "all" | "unassigned";
  priority: Priority | "all";
  projectId: ID | "all";
  label: TaskLabel | "all";
}

export interface ProjectFilters {
  search: string;
  status: ProjectStatus | "all";
  priority: Priority | "all";
  sort: "updated" | "due" | "name" | "progress";
}

export interface Preferences {
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  startOfWeek: 0 | 1;
  emailDigest: boolean;
  taskAssigned: boolean;
  commentsMentions: boolean;
  dueDateReminders: boolean;
  projectUpdates: boolean;
}

/**
 * The persisted envelope. Keeping a version alongside the data lets the store
 * migrate old payloads or discard payloads that can no longer be trusted.
 */
export interface PersistedState {
  version: number;
  workspaces: Record<ID, Workspace>;
  members: Record<ID, Member>;
  projects: Record<ID, Project>;
  tasks: Record<ID, Task>;
  events: Record<ID, CalendarEvent>;
  conversations: Record<ID, Conversation>;
  notifications: Record<ID, Notification>;
  activity: Record<ID, ActivityEntry>;
  activeWorkspaceId: ID;
  currentUserId: ID;
  preferences: Preferences;
}
