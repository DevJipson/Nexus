import type { Request, Response } from "express";
import { sendData } from "../../lib/http";
import { currentAuth } from "../../middleware/auth";
import { paramsOf, queryOf } from "../../middleware/validate";
import type { EventService } from "./events.service";
import type { WorkspaceService } from "../workspaces/workspaces.service";

export interface EventControllerDeps {
  events: EventService;
  workspaces: WorkspaceService;
}

export function createEventController(deps: EventControllerDeps) {
  const { events, workspaces } = deps;

  async function assertEventAccess(req: Request, eventId: string) {
    const event = await events.requireEvent(eventId);
    const { user } = currentAuth(req);
    await workspaces.requireMembership(event.workspace_id, user.id);
    return event;
  }

  return {
    async list(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireMembership(workspaceId, user.id);
      const query = queryOf<{ from?: string; to?: string }>(res);
      sendData(res, 200, { events: await events.list(workspaceId, query) });
    },

    async create(req: Request, res: Response): Promise<void> {
      const { workspaceId } = paramsOf<{ workspaceId: string }>(res);
      const { user } = currentAuth(req);
      await workspaces.requireRole(workspaceId, user.id, "member");
      const event = await events.create({ workspaceId, actorId: user.id, data: req.body });
      sendData(res, 201, { event });
    },

    async update(req: Request, res: Response): Promise<void> {
      const { eventId } = paramsOf<{ eventId: string }>(res);
      await assertEventAccess(req, eventId);
      const { user } = currentAuth(req);
      const event = await events.update({ eventId, actorId: user.id, data: req.body });
      sendData(res, 200, { event });
    },

    async remove(req: Request, res: Response): Promise<void> {
      const { eventId } = paramsOf<{ eventId: string }>(res);
      await assertEventAccess(req, eventId);
      await events.remove(eventId);
      sendData(res, 200, { ok: true });
    },
  };
}
