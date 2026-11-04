import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  createProjectBodySchema,
  listActivityQuerySchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  updateProjectBodySchema,
  workspaceIdParamSchema,
} from "../work/work.schemas";
import type { ProjectControllerDeps } from "./projects.controller";
import { createProjectController } from "./projects.controller";

export interface ProjectRoutesDeps extends ProjectControllerDeps {
  requireAuth: RequestHandler;
}

export function createProjectRoutes(deps: ProjectRoutesDeps): Router {
  const router = Router();
  const controller = createProjectController(deps);
  const auth = deps.requireAuth;

  // Workspace-scoped collection
  router.get(
    "/workspaces/:workspaceId/projects",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listProjectsQuerySchema),
    asyncHandler(controller.list),
  );
  router.post(
    "/workspaces/:workspaceId/projects",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(createProjectBodySchema),
    asyncHandler(controller.create),
  );
  router.get(
    "/workspaces/:workspaceId/labels",
    auth,
    validateParams(workspaceIdParamSchema),
    asyncHandler(controller.listLabels),
  );

  // Project-scoped
  router.get("/projects/:projectId", auth, validateParams(projectIdParamSchema), asyncHandler(controller.get));
  router.patch(
    "/projects/:projectId",
    auth,
    validateParams(projectIdParamSchema),
    validateBody(updateProjectBodySchema),
    asyncHandler(controller.update),
  );
  router.delete("/projects/:projectId", auth, validateParams(projectIdParamSchema), asyncHandler(controller.remove));
  router.get(
    "/projects/:projectId/tasks",
    auth,
    validateParams(projectIdParamSchema),
    asyncHandler(controller.listTasks),
  );
  router.get(
    "/projects/:projectId/activity",
    auth,
    validateParams(projectIdParamSchema),
    validateQuery(listActivityQuerySchema),
    asyncHandler(controller.activity),
  );

  return router;
}
