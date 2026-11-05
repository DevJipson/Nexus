/**
 * Live-mode client for projects and tasks.
 *
 * Wraps the typed `api()` client (src/lib/api.ts) with functions whose names
 * mirror the local store actions, so screens can branch on live vs. local with
 * minimal diff. Returns Promises; screens await mutations.
 *
 * Data shapes are normalized from the server DTOs to the frontend domain
 * types (see server/src/types/api.ts vs src/types/domain.ts).
 *
 * This module intentionally uses `any` for server response shapes — the backend
 * DTOs are not imported into the frontend, so the mapping functions below are
 * the type boundary.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { api, isBackendEnabled } from "./api";
import type {
  ActivityEntry,
  Attachment,
  Comment,
  Member,
  Priority,
  Project,
  ProjectStatus,
  Subtask,
  Task,
  TaskLabel,
  TaskStatus,
} from "@/types/domain";

/* ---------------------------------------------------------------- helpers */

function toProject(dto: any): Project {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    name: dto.name,
    key: dto.key,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
    colorHue: dto.colorHue,
    startDate: dto.startDate,
    dueDate: dto.dueDate,
    memberIds: dto.memberIds,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toSubtask(dto: any): Subtask {
  return { id: dto.id, title: dto.title, done: dto.done };
}

function toComment(dto: any): Comment {
  return { id: dto.id, authorId: dto.authorId, body: dto.body, createdAt: dto.createdAt };
}

function toAttachment(dto: any): Attachment {
  return {
    id: dto.id,
    name: dto.name,
    size: dto.size,
    mimeType: dto.mimeType,
    uploadedAt: dto.uploadedAt,
  };
}

function toTask(dto: any): Task {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    projectId: dto.projectId,
    title: dto.title,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
    assigneeId: dto.assigneeId,
    reporterId: dto.reporterId,
    dueDate: dto.dueDate,
    labels: dto.labels as TaskLabel[],
    order: dto.order,
    subtasks: (dto.subtasks ?? []).map(toSubtask),
    comments: (dto.comments ?? []).map(toComment),
    attachments: (dto.attachments ?? []).map(toAttachment),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    completedAt: dto.completedAt,
  };
}

function toActivityEntry(dto: any): ActivityEntry {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    actorId: dto.actorId,
    kind: dto.kind as ActivityEntry["kind"],
    entityType: dto.entityType as ActivityEntry["entityType"],
    entityId: dto.entityId,
    entityLabel: dto.entityLabel,
    projectId: dto.projectId,
    createdAt: dto.createdAt,
  };
}

/* ---------------------------------------------------------------- members */

export async function liveListMembers(workspaceId: string): Promise<any[]> {
  const { members } = await api<{ members: any[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
  );
  return members;
}

/* ---------------------------------------------------------------- events */

export interface LiveCreateEventInput {
  title: string;
  description: string;
  type: string;
  projectId: string | null;
  start: string;
  end: string;
  allDay: boolean;
  attendeeIds: string[];
  location: string;
}

export async function liveCreateEvent(workspaceId: string, input: LiveCreateEventInput): Promise<any> {
  const { event } = await api<{ event: any }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/events`,
    { method: "POST", json: input },
  );
  return event;
}

/* ---------------------------------------------------------------- projects */

export interface LiveProjectFilters {
  search?: string;
  status?: ProjectStatus | "all";
  priority?: Priority | "all";
  sort?: "updated" | "due" | "name" | "progress";
}

export interface LiveProjectWithStats {
  project: Project;
  memberIds: string[];
  stats: {
    total: number;
    done: number;
    open: number;
    inProgress: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    completionRate: number;
  };
}

export async function liveListProjects(
  workspaceId: string,
  filters: LiveProjectFilters = {},
): Promise<LiveProjectWithStats[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.sort) params.set("sort", filters.sort);
  const query = params.toString() ? `?${params.toString()}` : "";
  const { projects } = await api<{ projects: any[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/projects${query}`,
  );
  return projects.map((row) => ({
    project: toProject(row.project),
    memberIds: row.project.memberIds,
    stats: row.stats,
  }));
}

export async function liveGetProject(projectId: string): Promise<{ project: Project; stats: any }> {
  const { project, stats } = await api<{ project: any; stats: any }>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
  );
  return { project: toProject(project), stats };
}

export interface LiveCreateProjectInput {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  dueDate: string;
  memberIds: string[];
}

export async function liveCreateProject(workspaceId: string, input: LiveCreateProjectInput): Promise<Project> {
  const { project } = await api<{ project: any }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`,
    { method: "POST", json: input },
  );
  return toProject(project);
}

export interface LiveUpdateProjectPatch {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  dueDate?: string;
  memberIds?: string[];
  colorHue?: number;
}

export async function liveUpdateProject(projectId: string, patch: LiveUpdateProjectPatch): Promise<Project> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.dueDate !== undefined) body.dueDate = patch.dueDate ? new Date(`${patch.dueDate}T17:00:00`).toISOString() : null;
  if (patch.memberIds !== undefined) body.memberIds = patch.memberIds;
  if (patch.colorHue !== undefined) body.colorHue = patch.colorHue;
  const { project } = await api<{ project: any }>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    json: body,
  });
  return toProject(project);
}

export async function liveDeleteProject(projectId: string): Promise<void> {
  await api(`/api/v1/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

/* ---------------------------------------------------------------- tasks */

export interface LiveTaskFilters {
  assignee?: string;
  priority?: string;
  project?: string;
  label?: string;
  status?: string;
  search?: string;
}

export async function liveListTasks(workspaceId: string, filters: LiveTaskFilters = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.project) params.set("project", filters.project);
  if (filters.label) params.set("label", filters.label);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString() ? `?${params.toString()}` : "";
  const { tasks } = await api<{ tasks: any[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks${query}`,
  );
  return tasks.map(toTask);
}

export interface LiveCreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: TaskLabel[];
}

export async function liveCreateTask(workspaceId: string, input: LiveCreateTaskInput): Promise<Task> {
  const body: Record<string, unknown> = {
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    labels: input.labels ?? [],
  };
  if (input.assigneeId !== undefined) body.assigneeId = input.assigneeId;
  if (input.dueDate !== undefined) body.dueDate = input.dueDate ? new Date(`${input.dueDate}T17:00:00`).toISOString() : null;
  const { task } = await api<{ task: any }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks`,
    { method: "POST", json: body },
  );
  return toTask(task);
}

export interface LiveUpdateTaskPatch {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: TaskLabel[];
  projectId?: string;
}

export async function liveUpdateTask(taskId: string, patch: LiveUpdateTaskPatch): Promise<Task> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.assigneeId !== undefined) body.assigneeId = patch.assigneeId;
  if (patch.dueDate !== undefined) body.dueDate = patch.dueDate ? new Date(`${patch.dueDate}T17:00:00`).toISOString() : null;
  if (patch.labels !== undefined) body.labels = patch.labels;
  if (patch.projectId !== undefined) body.projectId = patch.projectId;
  const { task } = await api<{ task: any }>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    json: body,
  });
  return toTask(task);
}

export interface LiveMoveTaskInput {
  status: TaskStatus;
  index: number;
}

export async function liveMoveTask(
  taskId: string,
  input: LiveMoveTaskInput,
): Promise<{ task: Task; column: Task[] }> {
  const { task, column } = await api<{ task: any; column: any[] }>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/position`,
    { method: "PATCH", json: { status: input.status, index: input.index } },
  );
  return { task: toTask(task), column: column.map(toTask) };
}

export async function liveDeleteTask(taskId: string): Promise<void> {
  await api(`/api/v1/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

export interface LiveAddSubtaskInput {
  taskId: string;
  title: string;
}

export async function liveAddSubtask(input: LiveAddSubtaskInput): Promise<Subtask> {
  const { subtask } = await api<{ subtask: any }>(
    `/api/v1/tasks/${encodeURIComponent(input.taskId)}/subtasks`,
    { method: "POST", json: { title: input.title } },
  );
  return toSubtask(subtask);
}

export interface LiveUpdateSubtaskInput {
  taskId: string;
  subtaskId: string;
  data: { title?: string; done?: boolean };
}

export async function liveUpdateSubtask(input: LiveUpdateSubtaskInput): Promise<Subtask> {
  const body: Record<string, unknown> = {};
  if (input.data.title !== undefined) body.title = input.data.title;
  if (input.data.done !== undefined) body.done = input.data.done;
  const { subtask } = await api<{ subtask: any }>(
    `/api/v1/tasks/${encodeURIComponent(input.taskId)}/subtasks/${encodeURIComponent(input.subtaskId)}`,
    { method: "PATCH", json: body },
  );
  return toSubtask(subtask);
}

export async function liveDeleteSubtask(taskId: string, subtaskId: string): Promise<void> {
  await api(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
    { method: "DELETE" },
  );
}

export interface LiveAddCommentInput {
  taskId: string;
  authorId: string;
  body: string;
}

export async function liveAddComment(input: LiveAddCommentInput): Promise<Comment> {
  const { comment } = await api<{ comment: any }>(
    `/api/v1/tasks/${encodeURIComponent(input.taskId)}/comments`,
    { method: "POST", json: { body: input.body } },
  );
  return toComment(comment);
}

export async function liveListComments(taskId: string): Promise<Comment[]> {
  const { comments } = await api<{ comments: any[] }>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/comments`,
  );
  return comments.map(toComment);
}

export interface LiveAddAttachmentInput {
  taskId: string;
  uploaderId: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function liveAddAttachment(input: LiveAddAttachmentInput): Promise<Attachment> {
  const { attachment } = await api<{ attachment: any }>(
    `/api/v1/tasks/${encodeURIComponent(input.taskId)}/attachments`,
    { method: "POST", json: input },
  );
  return toAttachment(attachment);
}

export async function liveDeleteAttachment(taskId: string, attachmentId: string): Promise<void> {
  await api(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
}

/* ---------------------------------------------------------------- activity */

export async function liveListActivity(
  workspaceId: string,
  filters: { projectId?: string; limit?: number; before?: string } = {},
): Promise<ActivityEntry[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.before) params.set("before", filters.before);
  const query = params.toString() ? `?${params.toString()}` : "";
  const { activity } = await api<{ activity: any[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/activity${query}`,
  );
  return activity.map(toActivityEntry);
}

export function isLiveWorkEnabled(): boolean {
  return isBackendEnabled;
}
