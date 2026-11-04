import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateParams, validateQuery } from "../../middleware/validate";
import {
  listActivityQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  workspaceIdParamSchema,
} from "../work/work.schemas";
import type { FeedControllerDeps } from "./feeds.controller";
import { createFeedController } from "./feeds.controller";

export interface FeedRoutesDeps extends FeedControllerDeps {
  requireAuth: RequestHandler;
}

export function createFeedRoutes(deps: FeedRoutesDeps): Router {
  const router = Router();
  const controller = createFeedController(deps);
  const auth = deps.requireAuth;

  router.get(
    "/workspaces/:workspaceId/activity",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listActivityQuerySchema),
    asyncHandler(controller.activity),
  );

  router.get(
    "/workspaces/:workspaceId/notifications",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listNotificationsQuerySchema),
    asyncHandler(controller.listNotifications),
  );
  router.post(
    "/workspaces/:workspaceId/notifications/read-all",
    auth,
    validateParams(workspaceIdParamSchema),
    asyncHandler(controller.markAllRead),
  );
  router.post(
    "/notifications/:notificationId/read",
    auth,
    validateParams(notificationIdParamSchema),
    asyncHandler(controller.markRead),
  );

  return router;
}
