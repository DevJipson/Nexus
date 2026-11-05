import type { Pool, PoolClient } from "pg";
import type { Logger } from "../../lib/logger";
import { httpError } from "../../lib/errors";
import type { ProjectRow, TaskRow, LabelRow } from "../../types/rows";
import type { TaskStatsDto, LabelDto } from "../../types/api";
import { logActivity } from "../activity/activity.service";
import { emitters } from "../../sockets/emitters";
import { allocateProjectKey } from "./project-key";
import { toLabelDto, toProjectDto } from "./work.serializer";
import type { CreateProjectBody, UpdateProjectBody } from "../work/work.schemas";

/**
 * Project service.
 *
 * Reproduces the frontend store's project semantics exactly:
 * - creation defaults the member roster to the creator and derives a unique key
 * - update stamps updated_at and logs project.updated / project.completed
 * - delete cascades tasks, detaches events/conversations (DB-level SET NULL)
 */
export interface ProjectService {
  listWithStats(
    workspaceId: string,
    filters: { status?: string; priority?: string; search?: string; sort?: "updated" | "due" | "name" | "progress" },
  ): Promise<Array<{ project: ProjectRow; memberIds: string[]; stats: TaskStatsDto }>>;
  getProject(projectId: string): Promise<ProjectRow>;
  requireProject(projectId: string): Promise<ProjectRow>;
  createProject(input: { workspaceId: string; actorId: string; data: CreateProjectBody }): Promise<ProjectRow>;
  updateProject(input: { projectId: string; actorId: string; data: UpdateProjectBody }): Promise<ProjectRow>;
  deleteProject(input: { projectId: string; actorId: string }): Promise<void>;
  memberIds(projectId: string): Promise<string[]>;
  taskStats(projectId: string): Promise<TaskStatsDto>;
  assertMembersInWorkspace(workspaceId: string, memberIds: string[]): Promise<void>;
  listLabels(workspaceId: string): Promise<LabelDto[]>;
}

/** Computes the frontend `TaskStats` shape from raw task rows. */
export function computeTaskStats(rows: Array<Pick<TaskRow, "status" | "due_date" | "completed_at">>, now = new Date()): TaskStatsDto {
  const total = rows.length;
  const done = rows.filter((row) => row.status === "done").length;
  const open = total - done;
  const inProgress = rows.filter((row) => row.status === "in_progress" || row.status === "in_review").length;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

  let overdue = 0;
  let dueToday = 0;
  let dueThisWeek = 0;
  for (const row of rows) {
    if (!row.due_date || row.status === "done") continue;
    const due = row.due_date.getTime();
    if (due < now.getTime()) overdue += 1;
    if (due >= todayStart && due < tomorrowStart) dueToday += 1;
    if (due >= todayStart && due <= weekEnd) dueThisWeek += 1;
  }

  return {
    total,
    done,
    open,
    inProgress,
    overdue,
    dueToday,
    dueThisWeek,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function createProjectService(options: { pool: Pool; logger: Logger }): ProjectService {
  const { pool, logger } = options;

  async function requireProject(projectId: string): Promise<ProjectRow> {
    const result = await pool.query<ProjectRow>(
      "SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL",
      [projectId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Project not found.");
    return row;
  }

  async function memberIdsFor(projectId: string, db: Pool | PoolClient = pool): Promise<string[]> {
    const result = await db.query<{ user_id: string }>(
      "SELECT user_id FROM project_members WHERE project_id = $1 ORDER BY joined_at ASC",
      [projectId],
    );
    return result.rows.map((row) => row.user_id);
  }

  async function taskRowsFor(projectId: string): Promise<Array<Pick<TaskRow, "status" | "due_date" | "completed_at">>> {
    const result = await pool.query<Pick<TaskRow, "status" | "due_date" | "completed_at">>(
      "SELECT status, due_date, completed_at FROM tasks WHERE project_id = $1 AND deleted_at IS NULL",
      [projectId],
    );
    return result.rows;
  }

  return {
    async listWithStats(workspaceId, filters) {
      const result = await pool.query<ProjectRow>(
        "SELECT * FROM projects WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC",
        [workspaceId],
      );

      const needle = filters.search?.trim().toLowerCase();
      let rows = result.rows.filter((row) => {
        if (filters.status && row.status !== filters.status) return false;
        if (filters.priority && row.priority !== filters.priority) return false;
        if (needle) {
          const haystack = `${row.name} ${row.description} ${row.key}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });

      // Stats for all projects in the workspace, computed in one task query.
      const statsResult = await pool.query<{ project_id: string } & Pick<TaskRow, "status" | "due_date" | "completed_at">>(
        "SELECT project_id, status, due_date, completed_at FROM tasks WHERE workspace_id = $1 AND deleted_at IS NULL",
        [workspaceId],
      );
      const tasksByProject = new Map<string, Array<Pick<TaskRow, "status" | "due_date" | "completed_at">>>();
      for (const task of statsResult.rows) {
        const bucket = tasksByProject.get(task.project_id) ?? [];
        bucket.push(task);
        tasksByProject.set(task.project_id, bucket);
      }

      const enriched = rows.map((project) => ({
        project,
        stats: computeTaskStats(tasksByProject.get(project.id) ?? []),
      }));

      if (filters.sort === "name") {
        enriched.sort((a, b) => a.project.name.localeCompare(b.project.name));
      } else if (filters.sort === "due") {
        enriched.sort((a, b) => a.project.due_date.getTime() - b.project.due_date.getTime());
      } else if (filters.sort === "progress") {
        enriched.sort((a, b) => b.stats.completionRate - a.stats.completionRate);
      } else {
        enriched.sort((a, b) => b.project.updated_at.getTime() - a.project.updated_at.getTime());
      }

      rows = enriched.map((entry) => entry.project);
      const statsById = new Map(enriched.map((entry) => [entry.project.id, entry.stats]));

      const withMembers = await Promise.all(
        rows.map(async (project) => ({
          project,
          memberIds: await memberIdsFor(project.id),
          stats: statsById.get(project.id) as TaskStatsDto,
        })),
      );
      return withMembers;
    },

    getProject: async (projectId) => {
      const result = await pool.query<ProjectRow>(
        "SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL",
        [projectId],
      );
      return result.rows[0] as ProjectRow;
    },

    requireProject,

    async createProject(input) {
      const { workspaceId, actorId, data } = input;
      await this.assertMembersInWorkspace(workspaceId, data.memberIds);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const key = await allocateProjectKey(client, workspaceId, data.name);
        const now = new Date();
        const inserted = await client.query<ProjectRow>(
          `INSERT INTO projects (workspace_id, name, key, description, status, priority, color_hue, start_date, due_date, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
           RETURNING *`,
          [
            workspaceId,
            data.name,
            key,
            data.description,
            data.status,
            data.priority,
            data.colorHue ?? 264,
            data.startDate ? new Date(data.startDate) : now,
            new Date(data.dueDate),
            actorId,
          ],
        );
        const project = inserted.rows[0];
        if (!project) throw httpError.internal();

        for (const memberId of data.memberIds) {
          await client.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)", [project.id, memberId]);
        }

        await logActivity(client, {
          workspaceId,
          actorId,
          kind: "project.created",
          entityType: "project",
          entityId: project.id,
          entityLabel: project.name,
          projectId: project.id,
        });

        await client.query("COMMIT");
        logger.info({ projectId: project.id, workspaceId }, "project created");
        const memberIds = await memberIdsFor(project.id);
        emitters.projectCreated(workspaceId, { project: toProjectDto(project, memberIds) });
        emitters.activityCreated(workspaceId, { activity: { kind: "project.created", entityId: project.id, entityLabel: project.name } });
        return project;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async updateProject(input) {
      const { projectId, actorId, data } = input;
      const existing = await requireProject(projectId);
      if (data.memberIds) {
        await this.assertMembersInWorkspace(existing.workspace_id, data.memberIds);
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const updated = await client.query<ProjectRow>(
          `UPDATE projects
              SET name = COALESCE($2, name),
                  description = COALESCE($3, description),
                  status = COALESCE($4, status),
                  priority = COALESCE($5, priority),
                  due_date = COALESCE($6, due_date),
                  color_hue = COALESCE($7, color_hue),
                  updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL
          RETURNING *`,
          [
            projectId,
            data.name ?? null,
            data.description ?? null,
            data.status ?? null,
            data.priority ?? null,
            data.dueDate ? new Date(data.dueDate) : null,
            data.colorHue ?? null,
          ],
        );
        const project = updated.rows[0];
        if (!project) throw httpError.notFound("Project not found.");

        if (data.memberIds) {
          await client.query("DELETE FROM project_members WHERE project_id = $1", [projectId]);
          for (const memberId of data.memberIds) {
            await client.query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)", [projectId, memberId]);
          }
        }

        const kind = data.status === "completed" && existing.status !== "completed" ? "project.completed" : "project.updated";
        await logActivity(client, {
          workspaceId: project.workspace_id,
          actorId,
          kind,
          entityType: "project",
          entityId: project.id,
          entityLabel: project.name,
          projectId: project.id,
        });

        await client.query("COMMIT");
        const memberIds = await memberIdsFor(project.id);
        emitters.projectUpdated(project.workspace_id, { project: toProjectDto(project, memberIds) });
        emitters.activityCreated(project.workspace_id, { activity: { kind, entityId: project.id, entityLabel: project.name } });
        return project;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteProject(input) {
      const project = await requireProject(input.projectId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await logActivity(client, {
          workspaceId: project.workspace_id,
          actorId: input.actorId,
          kind: "project.updated",
          entityType: "project",
          entityId: project.id,
          entityLabel: project.name,
          projectId: project.id,
        });
        // Tasks cascade; events/conversations/activities detach via SET NULL.
        await client.query("DELETE FROM projects WHERE id = $1", [input.projectId]);
        await client.query("COMMIT");
        logger.info({ projectId: input.projectId, workspaceId: project.workspace_id }, "project deleted");
        emitters.projectDeleted(project.workspace_id, { projectId: input.projectId });
        emitters.activityCreated(project.workspace_id, { activity: { kind: "project.updated", entityId: input.projectId, entityLabel: project.name } });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    memberIds: (projectId) => memberIdsFor(projectId),

    async taskStats(projectId) {
      return computeTaskStats(await taskRowsFor(projectId));
    },

    async assertMembersInWorkspace(workspaceId, memberIds) {
      if (memberIds.length === 0) throw httpError.validation("Select at least one person.");
      const unique = [...new Set(memberIds)];
      const result = await pool.query<{ user_id: string }>(
        "SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])",
        [workspaceId, unique],
      );
      if (result.rowCount !== unique.length) {
        throw httpError.validation("One or more members do not belong to this workspace.");
      }
    },

    async listLabels(workspaceId) {
      const result = await pool.query<LabelRow>(
        "SELECT * FROM labels WHERE workspace_id = $1 ORDER BY name ASC",
        [workspaceId],
      );
      return result.rows.map(toLabelDto) satisfies LabelDto[];
    },
  };
}
