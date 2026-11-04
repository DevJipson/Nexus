import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  attachmentParamSchema,
  createAttachmentBodySchema,
  createCommentBodySchema,
  createSubtaskBodySchema,
  createTaskBodySchema,
  listCommentsQuerySchema,
  listTasksQuerySchema,
  moveTaskBodySchema,
  taskChildParamSchema,
  taskIdParamSchema,
  updateSubtaskBodySchema,
  updateTaskBodySchema,
  workspaceIdParamSchema,
} from "../work/work.schemas";
import type { TaskControllerDeps } from "./tasks.controller";
import { createTaskController } from "./tasks.controller";

export interface TaskRoutesDeps extends TaskControllerDeps {
  requireAuth: RequestHandler;
}

export function createTaskRoutes(deps: TaskRoutesDeps): Router {
  const router = Router();
  const controller = createTaskController(deps);
  const auth = deps.requireAuth;

  router.get(
    "/workspaces/:workspaceId/tasks",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listTasksQuerySchema),
    asyncHandler(controller.list),
  );
  router.post(
    "/workspaces/:workspaceId/tasks",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(createTaskBodySchema),
    asyncHandler(controller.create),
  );

  router.get("/tasks/:taskId", auth, validateParams(taskIdParamSchema), asyncHandler(controller.get));
  router.patch(
    "/tasks/:taskId",
    auth,
    validateParams(taskIdParamSchema),
    validateBody(updateTaskBodySchema),
    asyncHandler(controller.update),
  );
  router.patch(
    "/tasks/:taskId/position",
    auth,
    validateParams(taskIdParamSchema),
    validateBody(moveTaskBodySchema),
    asyncHandler(controller.move),
  );
  router.delete("/tasks/:taskId", auth, validateParams(taskIdParamSchema), asyncHandler(controller.remove));

  router.post(
    "/tasks/:taskId/subtasks",
    auth,
    validateParams(taskIdParamSchema),
    validateBody(createSubtaskBodySchema),
    asyncHandler(controller.addSubtask),
  );
  router.patch(
    "/tasks/:taskId/subtasks/:subtaskId",
    auth,
    validateParams(taskChildParamSchema),
    validateBody(updateSubtaskBodySchema),
    asyncHandler(controller.updateSubtask),
  );
  router.delete(
    "/tasks/:taskId/subtasks/:subtaskId",
    auth,
    validateParams(taskChildParamSchema),
    asyncHandler(controller.deleteSubtask),
  );

  router.get(
    "/tasks/:taskId/comments",
    auth,
    validateParams(taskIdParamSchema),
    validateQuery(listCommentsQuerySchema),
    asyncHandler(controller.listComments),
  );
  router.post(
    "/tasks/:taskId/comments",
    auth,
    validateParams(taskIdParamSchema),
    validateBody(createCommentBodySchema),
    asyncHandler(controller.addComment),
  );

  router.post(
    "/tasks/:taskId/attachments",
    auth,
    validateParams(taskIdParamSchema),
    validateBody(createAttachmentBodySchema),
    asyncHandler(controller.addAttachment),
  );
  router.delete(
    "/tasks/:taskId/attachments/:attachmentId",
    auth,
    validateParams(attachmentParamSchema),
    asyncHandler(controller.deleteAttachment),
  );

  return router;
}
