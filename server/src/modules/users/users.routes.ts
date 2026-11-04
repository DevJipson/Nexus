import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody } from "../../middleware/validate";
import { setActiveWorkspaceBodySchema, updatePreferencesBodySchema, updateProfileBodySchema } from "../auth/auth.schemas";
import type { UserControllerDeps } from "./users.controller";
import { createUserController } from "./users.controller";

export interface UserRoutesDeps extends UserControllerDeps {
  requireAuth: RequestHandler;
}

export function createUserRoutes(deps: UserRoutesDeps): Router {
  const router = Router();
  const controller = createUserController(deps);
  const auth = deps.requireAuth;

  router.get("/me", auth, asyncHandler(controller.me));
  router.patch("/me/profile", auth, validateBody(updateProfileBodySchema), asyncHandler(controller.updateProfile));
  router.patch("/me/preferences", auth, validateBody(updatePreferencesBodySchema), asyncHandler(controller.updatePreferences));
  router.patch(
    "/me/active-workspace",
    auth,
    validateBody(setActiveWorkspaceBodySchema),
    asyncHandler(controller.setActiveWorkspace),
  );

  return router;
}
