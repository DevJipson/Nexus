import type { QueryResultRow } from "pg";
import type {
  ActivityDto,
  AttachmentDto,
  CalendarEventDto,
  CommentDto,
  LabelDto,
  ProjectDto,
  SubtaskDto,
  TaskDto,
} from "../../types/api";
import type {
  ActivityRow,
  AttachmentRow,
  CalendarEventRow,
  CommentRow,
  LabelRow,
  ProjectRow,
  SubtaskRow,
  TaskRow,
} from "../../types/rows";

/**
 * Row → DTO mapping for Phase 3 entities. Field names and null handling match
 * the frontend `src/types/domain.ts` exactly. `bigint` columns (attachment
 * size) arrive as strings from node-postgres and are converted to numbers.
 */

export function toProjectDto(row: ProjectRow, memberIds: string[]): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
    priority: row.priority,
    colorHue: row.color_hue,
    startDate: row.start_date.toISOString(),
    dueDate: row.due_date.toISOString(),
    memberIds,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toSubtaskDto(row: SubtaskRow): SubtaskDto {
  return { id: row.id, title: row.title, done: row.done, order: row.sort_order };
}

export function toCommentDto(row: CommentRow): CommentDto {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toAttachmentDto(row: AttachmentRow): AttachmentDto {
  return {
    id: row.id,
    name: row.name,
    size: Number(row.size_bytes),
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at.toISOString(),
  };
}

export interface TaskChildren {
  labels: string[];
  subtasks: SubtaskRow[];
  comments: CommentRow[];
  attachments: AttachmentRow[];
}

export function toTaskDto(row: TaskRow, children: TaskChildren): TaskDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    reporterId: row.reporter_id,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    labels: children.labels,
    order: row.sort_order,
    subtasks: children.subtasks.map(toSubtaskDto),
    comments: children.comments.map(toCommentDto),
    attachments: children.attachments.map(toAttachmentDto),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

export function toEventDto(row: CalendarEventRow, attendeeIds: string[]): CalendarEventDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    type: row.type,
    projectId: row.project_id,
    start: row.start_at.toISOString(),
    end: row.end_at.toISOString(),
    allDay: row.all_day,
    attendeeIds,
    location: row.location,
    createdAt: row.created_at.toISOString(),
  };
}

export function toActivityDto(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    kind: row.kind,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    projectId: row.project_id,
    createdAt: row.created_at.toISOString(),
  };
}

export function toLabelDto(row: LabelRow): LabelDto {
  return { id: row.id, name: row.name, hue: row.hue };
}

/**
 * Loads children (labels, subtasks, comments, attachments) for a set of tasks
 * in three grouped queries rather than N+1. Empty task lists short-circuit.
 */
export async function loadTaskChildren(
  client: { query: <R extends QueryResultRow>(text: string, values?: unknown[]) => Promise<{ rows: R[] }> },
  taskIds: string[],
): Promise<Map<string, TaskChildren>> {
  const map = new Map<string, TaskChildren>();
  for (const id of taskIds) {
    map.set(id, { labels: [], subtasks: [], comments: [], attachments: [] });
  }
  if (taskIds.length === 0) return map;

  const labels = await client.query<{ task_id: string; name: string }>(
    `SELECT tl.task_id, l.name
       FROM task_labels tl
       JOIN labels l ON l.id = tl.label_id
      WHERE tl.task_id = ANY($1::uuid[])
      ORDER BY l.name ASC`,
    [taskIds],
  );
  for (const row of labels.rows) {
    map.get(row.task_id)?.labels.push(row.name);
  }

  const subtasks = await client.query<SubtaskRow>(
    "SELECT * FROM subtasks WHERE task_id = ANY($1::uuid[]) ORDER BY sort_order ASC, created_at ASC",
    [taskIds],
  );
  for (const row of subtasks.rows) {
    map.get(row.task_id)?.subtasks.push(row);
  }

  const comments = await client.query<CommentRow>(
    "SELECT * FROM comments WHERE task_id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY created_at ASC",
    [taskIds],
  );
  for (const row of comments.rows) {
    map.get(row.task_id)?.comments.push(row);
  }

  const attachments = await client.query<AttachmentRow>(
    "SELECT * FROM attachments WHERE task_id = ANY($1::uuid[]) ORDER BY uploaded_at ASC",
    [taskIds],
  );
  for (const row of attachments.rows) {
    map.get(row.task_id)?.attachments.push(row);
  }

  return map;
}
