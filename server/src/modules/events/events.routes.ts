import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  createEventBodySchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  updateEventBodySchema,
  workspaceIdParamSchema,
} from "../work/work.schemas";
import type { EventControllerDeps } from "./events.controller";
import { createEventController } from "./events.controller";

export interface EventRoutesDeps extends EventControllerDeps {
  requireAuth: RequestHandler;
}

export function createEventRoutes(deps: EventRoutesDeps): Router {
  const router = Router();
  const controller = createEventController(deps);
  const auth = deps.requireAuth;

  router.get(
    "/workspaces/:workspaceId/events",
    auth,
    validateParams(workspaceIdParamSchema),
    validateQuery(listEventsQuerySchema),
    asyncHandler(controller.list),
  );
  router.post(
    "/workspaces/:workspaceId/events",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(createEventBodySchema),
    asyncHandler(controller.create),
  );

  router.patch(
    "/events/:eventId",
    auth,
    validateParams(eventIdParamSchema),
    validateBody(updateEventBodySchema),
    asyncHandler(controller.update),
  );
  router.delete("/events/:eventId", auth, validateParams(eventIdParamSchema), asyncHandler(controller.remove));

  return router;
}
