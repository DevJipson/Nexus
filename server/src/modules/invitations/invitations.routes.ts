import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams } from "../../middleware/validate";
import {
  acceptInvitationBodySchema,
  createInvitationBodySchema,
  invitationIdParamSchema,
  workspaceIdParamSchema,
} from "../auth/auth.schemas";
import type { InvitationControllerDeps } from "./invitations.controller";
import { createInvitationController } from "./invitations.controller";

export interface InvitationRoutesDeps extends InvitationControllerDeps {
  requireAuth: RequestHandler;
}

const tokenParamSchema = z.object({ token: z.string().trim().min(10).max(200) });

export function createInvitationRoutes(deps: InvitationRoutesDeps): Router {
  const router = Router();
  const controller = createInvitationController(deps);
  const auth = deps.requireAuth;

  // Public preview (the accept screen shows workspace + inviter before sign-in).
  router.get("/invitations/:token", validateParams(tokenParamSchema), asyncHandler(controller.preview));

  router.post("/invitations/accept", auth, validateBody(acceptInvitationBodySchema), asyncHandler(controller.accept));

  router.get(
    "/workspaces/:workspaceId/invitations",
    auth,
    validateParams(workspaceIdParamSchema),
    asyncHandler(controller.list),
  );
  router.post(
    "/workspaces/:workspaceId/invitations",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(createInvitationBodySchema),
    asyncHandler(controller.create),
  );
  router.delete(
    "/workspaces/:workspaceId/invitations/:invitationId",
    auth,
    validateParams(invitationIdParamSchema),
    asyncHandler(controller.revoke),
  );

  return router;
}
