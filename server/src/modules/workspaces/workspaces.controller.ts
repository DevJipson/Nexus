import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { httpError } from "../../lib/errors";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { WorkspaceService } from "./workspaces.service";
import { defaultPresence, toMemberDto } from "../users/users.serializer";
import type { WorkspaceRole } from "../../types/domain";
import type { WorkspaceRow } from "../../types/rows";

export interface WorkspaceControllerDeps {
  workspaces: WorkspaceService;
}

function toWorkspaceDto(row: WorkspaceRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    description: row.description,
    accentHue: row.accent_hue,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function createWorkspaceController(deps: WorkspaceControllerDeps) {
  const { workspaces } = deps;

  return {
    async list(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      sendData(res, 200, { workspaces: await workspaces.listForUser(user.id) });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { user } = currentAuth(req);
      const body = req.body as { name: string; description?: string };
      const workspace = await workspaces.createWorkspace({
        name: body.name,
        description: body.description,
        ownerId: user.id,
      });
      await workspaces.setActiveWorkspace(user.id, workspace.id);
      sendData(res, 201, { workspace: toWorkspaceDto(workspace), role: "owner" satisfies WorkspaceRole });
    },

    async get(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const workspace = await workspaces.requireWorkspace(workspaceId);
      sendData(res, 200, { workspace: toWorkspaceDto(workspace) });
    },

    async update(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "admin");
      const body = req.body as { name?: string; description?: string };
      const workspace = await workspaces.updateWorkspace(workspaceId, body);
      sendData(res, 200, { workspace: toWorkspaceDto(workspace) });
    },

    async remove(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "owner");
      await workspaces.softDeleteWorkspace(workspaceId);
      sendData(res, 200, { ok: true });
    },

    async listMembers(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ query?: string; role?: WorkspaceRole | "all" }>(res);
      const rows = await workspaces.listMembers(workspaceId, query);
      const members = rows.map((row) => toMemberDto(row, workspaceId, defaultPresence()));
      sendData(res, 200, { members });
    },

    async updateMemberRole(req: Request, res: Response): Promise<void> {
      const { workspaceId, userId } = paramsOf<{ workspaceId: string; userId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "owner");
      const { role } = req.body as { role: WorkspaceRole };

      const membership = await workspaces.getMembership(workspaceId, userId);
      if (!membership) throw httpError.notFound("That person is not a member of this workspace.");

      if (membership.role === "owner" && role !== "owner") {
        const owners = await workspaces.countOwners(workspaceId);
        if (owners <= 1) throw httpError.conflict("A workspace must keep at least one owner.");
      }

      await workspaces.setMemberRole(workspaceId, userId, role);
      const rows = await workspaces.listMembers(workspaceId, {});
      const updated = rows.find((row) => row.id === userId);
      sendData(res, 200, { member: updated ? toMemberDto(updated, workspaceId, defaultPresence()) : null });
    },

    async removeMember(req: Request, res: Response): Promise<void> {
      const { workspaceId, userId } = paramsOf<{ workspaceId: string; userId: string }>(res);
      const { user } = currentAuth(req);

      if (user.id === userId) {
        // Leaving is allowed for any member.
        await workspaces.requireMembership(workspaceId, user.id);
      } else {
        await workspaces.requireRole(workspaceId, user.id, "admin");
      }

      const membership = await workspaces.getMembership(workspaceId, userId);
      if (!membership) throw httpError.notFound("That person is not a member of this workspace.");

      if (membership.role === "owner") {
        const owners = await workspaces.countOwners(workspaceId);
        if (owners <= 1) throw httpError.conflict("A workspace must keep at least one owner.");
      }

      await workspaces.removeMember(workspaceId, userId);
      sendData(res, 200, { ok: true });
    },
  };
}
