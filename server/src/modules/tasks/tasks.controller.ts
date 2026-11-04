import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { TaskService } from "./tasks.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import { toSubtaskDto, toCommentDto, toAttachmentDto } from "../projects/work.serializer";

export interface TaskControllerDeps {
  tasks: TaskService;
  workspaces: WorkspaceService;
}

/** Verifies the caller belongs to the task's workspace (404 hides existence). */
async function assertTaskAccess(req: Request, deps: TaskControllerDeps, taskId: string) {
  const task = await deps.tasks.requireTask(taskId);
  const { user } = currentAuth(req);
  await deps.workspaces.requireMembership(task.workspace_id, user.id);
  return task;
}

export function createTaskController(deps: TaskControllerDeps) {
  const { tasks, workspaces } = deps;

  return {
    async list(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ assignee?: string; priority?: string; project?: string; label?: string; status?: string; search?: string }>(res);
      sendData(res, 200, { tasks: await tasks.listForWorkspace(workspaceId, query) });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const task = await tasks.createTask({ workspaceId, actorId: user.id, data: req.body });
      sendData(res, 201, { task });
    },

    async get(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      sendData(res, 200, { task: await tasks.getTaskDto(taskId) });
    },

    async update(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const { user } = currentAuth(req);
      const task = await tasks.updateTask({ taskId, actorId: user.id, data: req.body });
      sendData(res, 200, { task });
    },

    async move(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const { user } = currentAuth(req);
      const result = await tasks.moveTask({ taskId, actorId: user.id, data: req.body });
      sendData(res, 200, result);
    },

    async remove(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const { user } = currentAuth(req);
      await tasks.deleteTask({ taskId, actorId: user.id });
      sendData(res, 200, { ok: true });
    },

    async addSubtask(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const subtask = await tasks.addSubtask({ taskId, title: (req.body as { title: string }).title });
      sendData(res, 201, { subtask: toSubtaskDto(subtask) });
    },

    async updateSubtask(req: Request, res: Response): Promise<void> {
      const { taskId, subtaskId } = paramsOf<{ taskId: string; subtaskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const subtask = await tasks.updateSubtask({ taskId, subtaskId, data: req.body });
      sendData(res, 200, { subtask: toSubtaskDto(subtask) });
    },

    async deleteSubtask(req: Request, res: Response): Promise<void> {
      const { taskId, subtaskId } = paramsOf<{ taskId: string; subtaskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      await tasks.deleteSubtask(taskId, subtaskId);
      sendData(res, 200, { ok: true });
    },

    async listComments(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const comments = await tasks.listComments(taskId);
      sendData(res, 200, { comments: comments.map(toCommentDto) });
    },

    async addComment(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const { user } = currentAuth(req);
      const comment = await tasks.addComment({ taskId, authorId: user.id, body: (req.body as { body: string }).body });
      sendData(res, 201, { comment: toCommentDto(comment) });
    },

    async addAttachment(req: Request, res: Response): Promise<void> {
      const { taskId } = paramsOf<{ taskId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      const { user } = currentAuth(req);
      const body = req.body as { name: string; size: number; mimeType: string };
      const attachment = await tasks.addAttachment({
        taskId,
        uploaderId: user.id,
        name: body.name,
        size: body.size,
        mimeType: body.mimeType,
      });
      sendData(res, 201, { attachment: toAttachmentDto(attachment) });
    },

    async deleteAttachment(req: Request, res: Response): Promise<void> {
      const { taskId, attachmentId } = paramsOf<{ taskId: string; attachmentId: string }>(res);
      await assertTaskAccess(req, deps, taskId);
      await tasks.deleteAttachment(taskId, attachmentId);
      sendData(res, 200, { ok: true });
    },
  };
}
