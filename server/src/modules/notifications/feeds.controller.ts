import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { FeedService } from "./feeds.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";

export interface FeedControllerDeps {
  feeds: FeedService;
  workspaces: WorkspaceService;
}

export function createFeedController(deps: FeedControllerDeps) {
  const { feeds, workspaces } = deps;

  return {
    async activity(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ projectId?: string; limit?: number; before?: string }>(res);
      sendData(res, 200, { activity: await feeds.listActivity(workspaceId, query) });
    },

    async listNotifications(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ unread?: string; limit?: number }>(res);
      const result = await feeds.listNotifications(workspaceId, user.id, {
        unreadOnly: query.unread === "true",
        limit: query.limit,
      });
      sendData(res, 200, result);
    },

    async markRead(req: Request, res: Response): Promise<void> {
      const { notificationId } = paramsOf<{ notificationId: string }>(res);
      const { user } = currentAuth(req);
      const notification = await feeds.markNotificationRead(notificationId, user.id);
      sendData(res, 200, { notification });
    },

    async markAllRead(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const updated = await feeds.markAllNotificationsRead(workspaceId, user.id);
      sendData(res, 200, { ok: true, updated });
    },
  };
}
