import { Router, type RequestHandler } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import {
  conversationIdParamSchema,
  createConversationBodySchema,
  listMessagesQuerySchema,
  sendMessageBodySchema,
} from "./conversations.schemas";
import { workspaceIdParamSchema } from "../work/work.schemas";
import type { ConversationControllerDeps } from "./conversations.controller";
import { createConversationController } from "./conversations.controller";

export interface ConversationRoutesDeps extends ConversationControllerDeps {
  requireAuth: RequestHandler;
}

export function createConversationRoutes(deps: ConversationRoutesDeps): Router {
  const router = Router();
  const controller = createConversationController(deps);
  const auth = deps.requireAuth;

  router.get(
    "/workspaces/:workspaceId/conversations",
    auth,
    validateParams(workspaceIdParamSchema),
    asyncHandler(controller.list),
  );
  router.post(
    "/workspaces/:workspaceId/conversations",
    auth,
    validateParams(workspaceIdParamSchema),
    validateBody(createConversationBodySchema),
    asyncHandler(controller.create),
  );

  router.get(
    "/conversations/:conversationId/messages",
    auth,
    validateParams(conversationIdParamSchema),
    validateQuery(listMessagesQuerySchema),
    asyncHandler(controller.listMessages),
  );
  router.post(
    "/conversations/:conversationId/messages",
    auth,
    validateParams(conversationIdParamSchema),
    validateBody(sendMessageBodySchema),
    asyncHandler(controller.sendMessage),
  );
  router.post(
    "/conversations/:conversationId/read",
    auth,
    validateParams(conversationIdParamSchema),
    asyncHandler(controller.markRead),
  );
  router.get(
    "/conversations/:conversationId/last-read",
    auth,
    validateParams(conversationIdParamSchema),
    asyncHandler(controller.verifyUnread),
  );

  return router;
}
