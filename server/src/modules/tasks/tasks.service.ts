import type { Pool, PoolClient } from "pg";
import type { Logger } from "../../lib/logger";
import { httpError } from "../../lib/errors";
import type { AttachmentRow, CommentRow, SubtaskRow, TaskRow } from "../../types/rows";
import type { TaskStatus } from "../../types/domain";
import { logActivity } from "../activity/activity.service";
import { createNotification } from "../notifications/notifications.service";
import { loadTaskChildren, toTaskDto, type TaskChildren } from "../projects/work.serializer";
import type { TaskDto } from "../../types/api";
import type { CreateTaskBody, MoveTaskBody, UpdateTaskBody } from "../work/work.schemas";
import type { ProjectService } from "../projects/projects.service";

/**
 * Task service.
 *
 * Reproduces the frontend store semantics exactly:
 * - create: order = max(column order) + 1; reporter = actor; completedAt when
 *   status is done; logs task.created (+ task.assigned when assignee ≠ actor);
 *   bumps the project's updated_at.
 * - update: stamps completedAt on transition into done, clears it otherwise;
 *   logs task.completed vs task.updated; reassigning notifies the assignee.
 * - move: renumbers the entire target column 1..n in one transaction.
 */

export interface TaskService {
  listForWorkspace(workspaceId: string, filters: {
    assignee?: string;
    priority?: string;
    project?: string;
    label?: string;
    status?: string;
    search?: string;
  }): Promise<TaskDto[]>;
  listForProject(projectId: string): Promise<TaskDto[]>;
  getTask(taskId: string): Promise<TaskRow>;
  requireTask(taskId: string): Promise<TaskRow>;
  getTaskDto(taskId: string): Promise<TaskDto>;
  createTask(input: { workspaceId: string; actorId: string; data: CreateTaskBody }): Promise<TaskDto>;
  updateTask(input: { taskId: string; actorId: string; data: UpdateTaskBody }): Promise<TaskDto>;
  moveTask(input: { taskId: string; actorId: string; data: MoveTaskBody }): Promise<{ task: TaskDto; column: TaskDto[] }>;
  deleteTask(input: { taskId: string; actorId: string }): Promise<void>;
  addSubtask(input: { taskId: string; title: string }): Promise<SubtaskRow>;
  updateSubtask(input: { taskId: string; subtaskId: string; data: { title?: string; done?: boolean } }): Promise<SubtaskRow>;
  deleteSubtask(taskId: string, subtaskId: string): Promise<void>;
  addComment(input: { taskId: string; authorId: string; body: string }): Promise<CommentRow>;
  listComments(taskId: string): Promise<CommentRow[]>;
  addAttachment(input: { taskId: string; uploaderId: string; name: string; size: number; mimeType: string }): Promise<AttachmentRow>;
  deleteAttachment(taskId: string, attachmentId: string): Promise<void>;
}

export function createTaskService(options: { pool: Pool; logger: Logger; projects: ProjectService }): TaskService {
  const { pool, logger, projects } = options;

  async function requireTask(taskId: string): Promise<TaskRow> {
    const result = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL", [taskId]);
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Task not found.");
    return row;
  }

  async function dtoForRows(db: Pool | PoolClient, rows: TaskRow[]): Promise<TaskDto[]> {
    const children = await loadTaskChildren(db as PoolClient, rows.map((row) => row.id));
    return rows.map((row) => toTaskDto(row, children.get(row.id) ?? emptyChildren()));
  }

  function emptyChildren(): TaskChildren {
    return { labels: [], subtasks: [], comments: [], attachments: [] };
  }

  async function currentColumnOrder(workspaceId: string, status: TaskStatus): Promise<number> {
    const result = await pool.query<{ max: number | null }>(
      "SELECT MAX(sort_order) AS max FROM tasks WHERE workspace_id = $1 AND status = $2 AND deleted_at IS NULL",
      [workspaceId, status],
    );
    return result.rows[0]?.max ?? 0;
  }

  async function resolveLabels(workspaceId: string, names: string[]): Promise<string[]> {
    if (names.length === 0) return [];
    const result = await pool.query<{ id: string; name: string }>(
      "SELECT id, name FROM labels WHERE workspace_id = $1 AND name = ANY($2::text[])",
      [workspaceId, names],
    );
    if (result.rowCount !== names.length) {
      throw httpError.validation("One or more labels are not valid for this workspace.");
    }
    return result.rows.map((row) => row.id);
  }

  return {
    async listForWorkspace(workspaceId, filters) {
      const conditions: string[] = ["workspace_id = $1", "deleted_at IS NULL"];
      const values: unknown[] = [workspaceId];

      if (filters.status) {
        values.push(filters.status);
        conditions.push(`status = $${values.length}`);
      }
      if (filters.priority) {
        values.push(filters.priority);
        conditions.push(`priority = $${values.length}`);
      }
      if (filters.project) {
        values.push(filters.project);
        conditions.push(`project_id = $${values.length}`);
      }
      if (filters.assignee) {
        if (filters.assignee === "unassigned") {
          conditions.push("assignee_id IS NULL");
        } else if (filters.assignee !== "all") {
          values.push(filters.assignee);
          conditions.push(`assignee_id = $${values.length}`);
        }
      }
      if (filters.search) {
        values.push(`%${filters.search.toLowerCase()}%`);
        conditions.push(`(lower(title) LIKE $${values.length} OR lower(description) LIKE $${values.length})`);
      }
      if (filters.label) {
        values.push(filters.label);
        conditions.push(
          `EXISTS (SELECT 1 FROM task_labels tl JOIN labels l ON l.id = tl.label_id WHERE tl.task_id = tasks.id AND l.name = $${values.length})`,
        );
      }

      const result = await pool.query<TaskRow>(
        `SELECT * FROM tasks WHERE ${conditions.join(" AND ")} ORDER BY status ASC, sort_order ASC`,
        values,
      );
      return dtoForRows(pool, result.rows);
    },

    async listForProject(projectId) {
      const result = await pool.query<TaskRow>(
        "SELECT * FROM tasks WHERE project_id = $1 AND deleted_at IS NULL ORDER BY status ASC, sort_order ASC",
        [projectId],
      );
      return dtoForRows(pool, result.rows);
    },

    getTask: async (taskId) => {
      const result = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL", [taskId]);
      return result.rows[0] as TaskRow;
    },

    requireTask,

    async getTaskDto(taskId) {
      const task = await requireTask(taskId);
      const children = await loadTaskChildren(pool, [task.id]);
      return toTaskDto(task, children.get(task.id) ?? emptyChildren());
    },

    async createTask(input) {
      const { workspaceId, actorId, data } = input;
      const project = await projects.requireProject(data.projectId);
      if (project.workspace_id !== workspaceId) {
        throw httpError.validation("The project does not belong to this workspace.");
      }
      if (data.assigneeId) {
        await projects.assertMembersInWorkspace(workspaceId, [data.assigneeId]);
      }
      const labelIds = await resolveLabels(workspaceId, data.labels);
      const order = (await currentColumnOrder(workspaceId, data.status)) + 1;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const now = new Date();
        const inserted = await client.query<TaskRow>(
          `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assignee_id, reporter_id, due_date, sort_order, completed_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
           RETURNING *`,
          [
            workspaceId,
            data.projectId,
            data.title,
            data.description,
            data.status,
            data.priority,
            data.assigneeId ?? null,
            actorId,
            data.dueDate ? new Date(data.dueDate) : null,
            order,
            data.status === "done" ? now : null,
          ],
        );
        const task = inserted.rows[0];
        if (!task) throw httpError.internal();

        for (const labelId of labelIds) {
          await client.query("INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)", [task.id, labelId]);
        }

        await client.query("UPDATE projects SET updated_at = now() WHERE id = $1", [data.projectId]);

        await logActivity(client, {
          workspaceId,
          actorId,
          kind: "task.created",
          entityType: "task",
          entityId: task.id,
          entityLabel: task.title,
          projectId: task.project_id,
        });

        if (task.assignee_id && task.assignee_id !== actorId) {
          await logActivity(client, {
            workspaceId,
            actorId,
            kind: "task.assigned",
            entityType: "task",
            entityId: task.id,
            entityLabel: task.title,
            projectId: task.project_id,
          });
          await createNotification(client, {
            workspaceId,
            userId: task.assignee_id,
            category: "task",
            title: "You were assigned a task",
            body: `${task.title} · ${project.name}`,
            href: "/tasks",
          });
        }

        await client.query("COMMIT");
        const children = await loadTaskChildren(pool, [task.id]);
        return toTaskDto(task, children.get(task.id) ?? emptyChildren());
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTask(input) {
      const { taskId, actorId, data } = input;
      const existing = await requireTask(taskId);

      if (data.projectId && data.projectId !== existing.project_id) {
        const project = await projects.requireProject(data.projectId);
        if (project.workspace_id !== existing.workspace_id) {
          throw httpError.validation("Tasks cannot move between workspaces.");
        }
      }
      if (data.assigneeId) {
        await projects.assertMembersInWorkspace(existing.workspace_id, [data.assigneeId]);
      }
      const labelIds = data.labels ? await resolveLabels(existing.workspace_id, data.labels) : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const nextStatus = data.status ?? existing.status;
        const updated = await client.query<TaskRow>(
          `UPDATE tasks
              SET title = COALESCE($2, title),
                  description = COALESCE($3, description),
                  status = COALESCE($4, status),
                  priority = COALESCE($5, priority),
                  assignee_id = CASE WHEN $6::boolean THEN $7 ELSE assignee_id END,
                  due_date = CASE WHEN $8::boolean THEN $9 ELSE due_date END,
                  project_id = COALESCE($10, project_id),
                  completed_at = CASE
                    WHEN $4::task_status = 'done' THEN COALESCE(completed_at, now())
                    WHEN $4::task_status IS NOT NULL THEN NULL
                    ELSE completed_at
                  END,
                  updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL
          RETURNING *`,
          [
            taskId,
            data.title ?? null,
            data.description ?? null,
            data.status ?? null,
            data.priority ?? null,
            "assigneeId" in data,
            data.assigneeId ?? null,
            "dueDate" in data,
            data.dueDate ? new Date(data.dueDate) : null,
            data.projectId ?? null,
          ],
        );
        const task = updated.rows[0];
        if (!task) throw httpError.notFound("Task not found.");

        if (labelIds) {
          await client.query("DELETE FROM task_labels WHERE task_id = $1", [taskId]);
          for (const labelId of labelIds) {
            await client.query("INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)", [taskId, labelId]);
          }
        }

        const becameDone = nextStatus === "done" && existing.status !== "done";
        await logActivity(client, {
          workspaceId: task.workspace_id,
          actorId,
          kind: becameDone ? "task.completed" : "task.updated",
          entityType: "task",
          entityId: task.id,
          entityLabel: task.title,
          projectId: task.project_id,
        });

        const reassigned = "assigneeId" in data && task.assignee_id && task.assignee_id !== existing.assignee_id;
        if (reassigned && task.assignee_id && task.assignee_id !== actorId) {
          await logActivity(client, {
            workspaceId: task.workspace_id,
            actorId,
            kind: "task.assigned",
            entityType: "task",
            entityId: task.id,
            entityLabel: task.title,
            projectId: task.project_id,
          });
          await createNotification(client, {
            workspaceId: task.workspace_id,
            userId: task.assignee_id,
            category: "task",
            title: "You were assigned a task",
            body: task.title,
            href: "/tasks",
          });
        }

        await client.query("COMMIT");
        const children = await loadTaskChildren(pool, [task.id]);
        return toTaskDto(task, children.get(task.id) ?? emptyChildren());
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async moveTask(input) {
      const { taskId, actorId, data } = input;
      const existing = await requireTask(taskId);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock the workspace's tasks for this status to serialize concurrent moves.
        const column = await client.query<TaskRow>(
          `SELECT * FROM tasks
            WHERE workspace_id = $1 AND status = $2 AND deleted_at IS NULL AND id <> $3
            ORDER BY sort_order ASC
            FOR UPDATE`,
          [existing.workspace_id, data.status, taskId],
        );

        const ordered = column.rows.filter((task) => task.id !== taskId);
        const position = Math.max(0, Math.min(data.index, ordered.length));
        ordered.splice(position, 0, existing);

        const now = new Date();
        for (let index = 0; index < ordered.length; index += 1) {
          const item = ordered[index];
          if (!item) continue;
          const isDragged = item.id === taskId;
          await client.query(
            `UPDATE tasks
                SET status = $2,
                    sort_order = $3,
                    updated_at = CASE WHEN $4 THEN now() ELSE updated_at END,
                    completed_at = CASE WHEN $4 THEN $5 ELSE completed_at END
              WHERE id = $1`,
            [
              item.id,
              data.status,
              index + 1,
              isDragged,
              isDragged ? (data.status === "done" ? (item.completed_at ?? now) : null) : null,
            ],
          );
        }

        const becameDone = data.status === "done" && existing.status !== "done";
        await logActivity(client, {
          workspaceId: existing.workspace_id,
          actorId,
          kind: becameDone ? "task.completed" : "task.updated",
          entityType: "task",
          entityId: taskId,
          entityLabel: existing.title,
          projectId: existing.project_id,
        });

        await client.query("COMMIT");

        const moved = await requireTask(taskId);
        const columnRows = await pool.query<TaskRow>(
          "SELECT * FROM tasks WHERE workspace_id = $1 AND status = $2 AND deleted_at IS NULL ORDER BY sort_order ASC",
          [existing.workspace_id, data.status],
        );
        const columnDtos = await dtoForRows(pool, columnRows.rows);
        const children = await loadTaskChildren(pool, [moved.id]);
        return { task: toTaskDto(moved, children.get(moved.id) ?? emptyChildren()), column: columnDtos };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteTask(input) {
      const task = await requireTask(input.taskId);
      await pool.query("DELETE FROM tasks WHERE id = $1", [task.id]);
      logger.info({ taskId: task.id, workspaceId: task.workspace_id }, "task deleted");
    },

    async addSubtask(input) {
      const task = await requireTask(input.taskId);
      const next = await pool.query<{ next: number }>(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM subtasks WHERE task_id = $1",
        [task.id],
      );
      const result = await pool.query<SubtaskRow>(
        "INSERT INTO subtasks (task_id, title, sort_order) VALUES ($1, $2, $3) RETURNING *",
        [task.id, input.title, next.rows[0]?.next ?? 0],
      );
      await pool.query("UPDATE tasks SET updated_at = now() WHERE id = $1", [task.id]);
      const row = result.rows[0];
      if (!row) throw httpError.internal();
      return row;
    },

    async updateSubtask(input) {
      await requireTask(input.taskId);
      const result = await pool.query<SubtaskRow>(
        `UPDATE subtasks
            SET title = COALESCE($3, title), done = COALESCE($4, done)
          WHERE id = $2 AND task_id = $1
        RETURNING *`,
        [input.taskId, input.subtaskId, input.data.title ?? null, input.data.done ?? null],
      );
      const row = result.rows[0];
      if (!row) throw httpError.notFound("Subtask not found.");
      await pool.query("UPDATE tasks SET updated_at = now() WHERE id = $1", [input.taskId]);
      return row;
    },

    async deleteSubtask(taskId, subtaskId) {
      await requireTask(taskId);
      const result = await pool.query("DELETE FROM subtasks WHERE id = $1 AND task_id = $2", [subtaskId, taskId]);
      if (result.rowCount === 0) throw httpError.notFound("Subtask not found.");
    },

    async addComment(input) {
      const task = await requireTask(input.taskId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<CommentRow>(
          "INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING *",
          [task.id, input.authorId, input.body],
        );
        const row = result.rows[0];
        if (!row) throw httpError.internal();
        await client.query("UPDATE tasks SET updated_at = now() WHERE id = $1", [task.id]);
        await logActivity(client, {
          workspaceId: task.workspace_id,
          actorId: input.authorId,
          kind: "comment.created",
          entityType: "comment",
          entityId: row.id,
          entityLabel: task.title,
          projectId: task.project_id,
        });
        await client.query("COMMIT");
        return row;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async listComments(taskId) {
      await requireTask(taskId);
      const result = await pool.query<CommentRow>(
        "SELECT * FROM comments WHERE task_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
        [taskId],
      );
      return result.rows;
    },

    async addAttachment(input) {
      const task = await requireTask(input.taskId);
      const result = await pool.query<AttachmentRow>(
        `INSERT INTO attachments (task_id, uploaded_by, name, size_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [task.id, input.uploaderId, input.name, input.size, input.mimeType],
      );
      await pool.query("UPDATE tasks SET updated_at = now() WHERE id = $1", [task.id]);
      const row = result.rows[0];
      if (!row) throw httpError.internal();
      return row;
    },

    async deleteAttachment(taskId, attachmentId) {
      await requireTask(taskId);
      // Only the uploader or a workspace admin may delete; authorization is
      // enforced in the controller via membership role.
      const result = await pool.query("DELETE FROM attachments WHERE id = $1 AND task_id = $2", [attachmentId, taskId]);
      if (result.rowCount === 0) throw httpError.notFound("Attachment not found.");
    },
  };
}
