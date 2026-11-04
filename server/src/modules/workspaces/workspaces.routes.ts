import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  createWorkspaceBodySchema,
  listMembersQuerySchema,
  updateMemberRoleBodySchema,
  updateWorkspaceBodySchema,
  userIdParamSchema,
  workspaceIdParamSchema,
} from "../auth/auth.schemas";
import type { WorkspaceControllerDeps } from "./workspaces.controller";
import { createWorkspaceController } from "./workspaces.controller";

export interface WorkspaceRoutesDeps extends WorkspaceControllerDeps {
  requireAuth: RequestHandler;
}

/**
 * Auth is applied per-route (never with a blanket `router.use`) so unmatched
 * paths fall through to the 404 handler instead of being answered with 401.
 */
export function createWorkspaceRoutes(deps: WorkspaceRoutesDeps): Router {
  const router = Router();
  const controller = createWorkspaceController(deps);
  const auth = deps.requireAuth;

  router.get("/workspaces", auth, asyncHandler(controller.list));
  router.post("/workspaces", auth, validateBody(createWorkspaceBodySchema), asyncHandler(controller.create));
  router.get("/workspaces/:workspaceId", auth, validateParams(workspaceIdParamSchema), asyncHandler(controller.get));
  router.patch(
    "/workspaces/:workspaceId",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(updateWorkspaceBodySchema),
    asyncHandler(controller.update),
  );
  router.delete(
    "/workspaces/:workspaceId",
    auth,
    validateParams(workspaceIdParamSchema),
    asyncHandler(controller.remove),
  );

  router.get(
    "/workspaces/:workspaceId/members",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listMembersQuerySchema),
    asyncHandler(controller.listMembers),
  );
  router.patch(
    "/workspaces/:workspaceId/members/:userId",
    auth,
    validateParams(userIdParamSchema),
    validateBody(updateMemberRoleBodySchema),
    asyncHandler(controller.updateMemberRole),
  );
  router.delete(
    "/workspaces/:workspaceId/members/:userId",
    auth,
    validateParams(userIdParamSchema),
    asyncHandler(controller.removeMember),
  );

  return router;
}
