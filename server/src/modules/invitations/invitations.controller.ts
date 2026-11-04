import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import { paramsOf } from "../../middleware/validate";
import type { InvitationService } from "./invitations.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import type { WorkspaceRole } from "../../types/domain";

export interface InvitationControllerDeps {
  invitations: InvitationService;
  workspaces: WorkspaceService;
}

function toInvitationDto(row: {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  expires_at: Date;
  created_at: Date;
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export function createInvitationController(deps: InvitationControllerDeps) {
  const { invitations, workspaces } = deps;

  return {
    async create(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "admin");

      const body = req.body as { email: string; role: WorkspaceRole };
      const workspace = await workspaces.requireWorkspace(workspaceId);

      const invitation = await invitations.create({
        workspaceId,
        email: body.email,
        role: body.role,
        invitedBy: user.id,
        workspaceName: workspace.name,
        inviterName: user.name,
      });
      sendData(res, 201, { invitation: toInvitationDto(invitation) });
    },

    async list(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "admin");
      const rows = await invitations.listPending(workspaceId);
      sendData(res, 200, { invitations: rows.map(toInvitationDto) });
    },

    async revoke(req: Request, res: Response): Promise<void> {
      const { workspaceId, invitationId } = paramsOf<{ workspaceId: string; invitationId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "admin");
      await invitations.revoke(workspaceId, invitationId);
      sendData(res, 200, { ok: true });
    },

    async preview(req: Request, res: Response): Promise<void> {
      const { token } = paramsOf<{ token: string }>(res);
      sendData(res, 200, await invitations.preview(token));
    },

    async accept(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const { token } = req.body as { token: string };
      const membership = await invitations.accept(token, user.id);
      const list = await workspaces.listForUser(user.id);
      sendData(res, 200, {
        membership: { workspaceId: membership.workspace_id, role: membership.role },
        workspaces: list,
      });
    },
  };
}
