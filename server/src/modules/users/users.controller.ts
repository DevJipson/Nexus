import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import type { UserService } from "./users.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import { toUserDto } from "./users.serializer";
import type { UpdatePreferencesBody, UpdateProfileBody } from "../auth/auth.schemas";

export interface UserControllerDeps {
  users: UserService;
  workspaces: WorkspaceService;
}

export function createUserController(deps: UserControllerDeps) {
  const { users, workspaces } = deps;

  return {
    async me(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const [preferences, workspaceList, activeWorkspaceId] = await Promise.all([
        users.getPreferences(user.id),
        workspaces.listForUser(user.id),
        users.getActiveWorkspaceId(user.id),
      ]);
      sendData(res, 200, {
        user: toUserDto(user),
        preferences: preferences,
        workspaces: workspaceList,
        activeWorkspaceId,
      });
    },

    async updateProfile(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const result = await users.updateProfile(user, req.body as UpdateProfileBody);
      sendData(res, 200, { user: result.user, emailVerificationRequired: result.emailChanged });
    },

    async updatePreferences(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const preferences = await users.updatePreferences(user.id, req.body as UpdatePreferencesBody);
      sendData(res, 200, { preferences });
    },

    async setActiveWorkspace(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const { workspaceId } = req.body as { workspaceId: string };
      await workspaces.requireMembership(workspaceId, user.id);
      await workspaces.setActiveWorkspace(user.id, workspaceId);
      sendData(res, 200, { activeWorkspaceId: workspaceId });
    },
  };
}
