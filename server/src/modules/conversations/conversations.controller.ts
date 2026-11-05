import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { ConversationService } from "./conversations.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import { toMessageDto } from "./conversations.serializer";

export interface ConversationControllerDeps {
  conversations: ConversationService;
  workspaces: WorkspaceService;
}

export function createConversationController(deps: ConversationControllerDeps) {
  const { conversations, workspaces } = deps;

  return {
    async list(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const result = await conversations.listForWorkspace(workspaceId, user.id);
      sendData(res, 200, { conversations: result });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const body = req.body as { kind: "direct" | "group"; name?: string | null; participantIds: string[]; projectId?: string | null; firstMessage?: string };
      const conversation = await conversations.create({
        workspaceId,
        actorId: user.id,
        kind: body.kind,
        name: body.name,
        participantIds: body.participantIds,
        projectId: body.projectId,
        firstMessage: body.firstMessage,
      });
      sendData(res, 201, { conversation });
    },

    async listMessages(req: Request, res: Response): Promise<void> {
      const { conversationId } = paramsOf<{ conversationId: string }>(res);
      const { user } = currentAuth(req);
      const query = queryOf<{ before?: string; limit?: number }>(res);
      const { messages, hasMore } = await conversations.listMessages(conversationId, user.id, query);
      sendData(res, 200, { messages: messages.map(toMessageDto), hasMore });
    },

    async sendMessage(req: Request, res: Response): Promise<void> {
      const { conversationId } = paramsOf<{ conversationId: string }>(res);
      const { user } = currentAuth(req);
      const body = req.body as { body: string };
      const message = await conversations.sendMessage(conversationId, user.id, body.body);
      sendData(res, 201, { message });
    },

    async markRead(req: Request, res: Response): Promise<void> {
      const { conversationId } = paramsOf<{ conversationId: string }>(res);
      const { user } = currentAuth(req);
      await conversations.markRead(conversationId, user.id);
      sendData(res, 200, { ok: true });
    },

    async verifyUnread(req: Request, res: Response): Promise<void> {
      const { conversationId } = paramsOf<{ conversationId: string }>(res);
      const { user } = currentAuth(req);
      const lastReadAt = await conversations.getLastReadAt(conversationId, user.id);
      sendData(res, 200, { lastReadAt: lastReadAt ? lastReadAt.toISOString() : null });
    },
  };
}
