import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { httpError } from "../../lib/errors";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { ProjectService } from "./projects.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import type { TaskService } from "../tasks/tasks.service";
import type { FeedService } from "../notifications/feeds.service";
import { toProjectDto } from "./work.serializer";
import type { CreateProjectBody, UpdateProjectBody } from "../work/work.schemas";

export interface ProjectControllerDeps {
  projects: ProjectService;
  tasks: TaskService;
  workspaces: WorkspaceService;
  feeds: FeedService;
}

export function createProjectController(deps: ProjectControllerDeps) {
  const { projects, tasks, workspaces, feeds } = deps;

  /**
   * Resolves a project and verifies the caller is a member of its workspace.
   * Non-members receive 404 so project existence is never leaked.
   */
  async function requireProjectAccess(req: Request, projectId: string) {
    const project = await projects.requireProject(projectId);
    const { user } = currentAuth(req);
    await workspaces.requireMembership(project.workspace_id, user.id);
    return project;
  }

  return {
    async list(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ status?: string; priority?: string; search?: string; sort?: "updated" | "due" | "name" | "progress" }>(res);
      const rows = await projects.listWithStats(workspaceId, query);
      sendData(res, 200, {
        projects: rows.map((row) => ({
          ...toProjectDto(row.project, row.memberIds),
          stats: row.stats,
        })),
      });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "admin");
      const project = await projects.createProject({ workspaceId, actorId: user.id, data: req.body as CreateProjectBody });
      const memberIds = await projects.memberIds(project.id);
      sendData(res, 201, { project: toProjectDto(project, memberIds) });
    },

    async get(req: Request, res: Response): Promise<void> {
      const { projectId } = paramsOf<{ projectId: string }>(res);
      const project = await requireProjectAccess(req, projectId);
      const [memberIds, stats] = await Promise.all([projects.memberIds(projectId), projects.taskStats(projectId)]);
      sendData(res, 200, { project: toProjectDto(project, memberIds), stats });
    },

    async update(req: Request, res: Response): Promise<void> {
      const { projectId } = paramsOf<{ projectId: string }>(res);
      const project = await requireProjectAccess(req, projectId);
      const { user } = currentAuth(req);
      await workspaces.requireRole(project.workspace_id, user.id, "admin");
      const updated = await projects.updateProject({ projectId, actorId: user.id, data: req.body as UpdateProjectBody });
      const memberIds = await projects.memberIds(updated.id);
      sendData(res, 200, { project: toProjectDto(updated, memberIds) });
    },

    async remove(req: Request, res: Response): Promise<void> {
      const { projectId } = paramsOf<{ projectId: string }>(res);
      const project = await requireProjectAccess(req, projectId);
      const { user } = currentAuth(req);
      await workspaces.requireRole(project.workspace_id, user.id, "admin");
      await projects.deleteProject(projectId);
      sendData(res, 200, { ok: true });
    },

    async listTasks(req: Request, res: Response): Promise<void> {
      const { projectId } = paramsOf<{ projectId: string }>(res);
      await requireProjectAccess(req, projectId);
      sendData(res, 200, { tasks: await tasks.listForProject(projectId) });
    },

    async activity(req: Request, res: Response): Promise<void> {
      const { projectId } = paramsOf<{ projectId: string }>(res);
      const project = await requireProjectAccess(req, projectId);
      const { user } = currentAuth(req);
      void user;
      const entries = await feeds.listActivity(project.workspace_id, { projectId, limit: 8 });
      sendData(res, 200, { activity: entries });
    },

    async listLabels(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      sendData(res, 200, { labels: await projects.listLabels(workspaceId) });
    },

    /** Guard helper reused by nested routes (activities use NO explicit throw). */
    async assertProject(projectId: string, req: Request) {
      const project = await projects.requireProject(projectId);
      const { user } = currentAuth(req);
      if (!project) throw httpError.notFound("Project not found.");
      await workspaces.requireMembership(project.workspace_id, user.id);
      return project;
    },
  };
}
