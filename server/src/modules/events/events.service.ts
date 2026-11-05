import type { Pool } from "pg";
import type { Logger } from "../../lib/logger";
import { httpError } from "../../lib/errors";
import type { CalendarEventRow } from "../../types/rows";
import type { CalendarEventDto } from "../../types/api";
import { logActivity } from "../activity/activity.service";
import { emitters } from "../../sockets/emitters";
import { toEventDto } from "../projects/work.serializer";
import type { CreateEventBody, UpdateEventBody } from "../work/work.schemas";
import type { ProjectService } from "../projects/projects.service";

/**
 * Calendar event service. Creation logs `event.created` (matching the frontend
 * store). `project_id` detaches on project deletion via the DB's SET NULL.
 */

export interface EventService {
  list(workspaceId: string, filters: { from?: string; to?: string }): Promise<CalendarEventDto[]>;
  requireEvent(eventId: string): Promise<CalendarEventRow>;
  create(input: { workspaceId: string; actorId: string; data: CreateEventBody }): Promise<CalendarEventDto>;
  update(input: { eventId: string; actorId: string; data: UpdateEventBody }): Promise<CalendarEventDto>;
  remove(input: { eventId: string; actorId: string }): Promise<void>;
}

export function createEventService(options: { pool: Pool; logger: Logger; projects: ProjectService }): EventService {
  const { pool, projects } = options;

  async function attendeeIdsFor(eventId: string): Promise<string[]> {
    const result = await pool.query<{ user_id: string }>(
      "SELECT user_id FROM event_attendees WHERE event_id = $1 ORDER BY user_id ASC",
      [eventId],
    );
    return result.rows.map((row) => row.user_id);
  }

  async function requireEvent(eventId: string): Promise<CalendarEventRow> {
    const result = await pool.query<CalendarEventRow>("SELECT * FROM calendar_events WHERE id = $1", [eventId]);
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Event not found.");
    return row;
  }

  return {
    async list(workspaceId, filters) {
      const conditions = ["workspace_id = $1"];
      const values: unknown[] = [workspaceId];
      if (filters.from) {
        values.push(new Date(filters.from));
        conditions.push(`end_at >= $${values.length}`);
      }
      if (filters.to) {
        values.push(new Date(filters.to));
        conditions.push(`start_at <= $${values.length}`);
      }
      const result = await pool.query<CalendarEventRow>(
        `SELECT * FROM calendar_events WHERE ${conditions.join(" AND ")} ORDER BY start_at ASC`,
        values,
      );
      const attendees = await pool.query<{ event_id: string; user_id: string }>(
        "SELECT event_id, user_id FROM event_attendees WHERE event_id = ANY($1::uuid[])",
        [result.rows.map((row) => row.id)],
      );
      const byEvent = new Map<string, string[]>();
      for (const row of attendees.rows) {
        const bucket = byEvent.get(row.event_id) ?? [];
        bucket.push(row.user_id);
        byEvent.set(row.event_id, bucket);
      }
      return result.rows.map((row) => toEventDto(row, byEvent.get(row.id) ?? []));
    },

    requireEvent,

    async create(input) {
      const { workspaceId, actorId, data } = input;
      const attendeeIds = [...new Set(data.attendeeIds)];
      if (data.projectId) {
        const project = await projects.requireProject(data.projectId);
        if (project.workspace_id !== workspaceId) {
          throw httpError.validation("The project does not belong to this workspace.");
        }
      }
      await projects.assertMembersInWorkspace(workspaceId, attendeeIds);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<CalendarEventRow>(
          `INSERT INTO calendar_events (workspace_id, project_id, title, description, type, start_at, end_at, all_day, location, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
           RETURNING *`,
          [
            workspaceId,
            data.projectId ?? null,
            data.title,
            data.description,
            data.type,
            new Date(data.start),
            new Date(data.end),
            data.allDay,
            data.location,
            actorId,
          ],
        );
        const event = result.rows[0];
        if (!event) throw httpError.internal();

        for (const attendeeId of attendeeIds) {
          await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [event.id, attendeeId]);
        }

        await logActivity(client, {
          workspaceId,
          actorId,
          kind: "event.created",
          entityType: "event",
          entityId: event.id,
          entityLabel: event.title,
          projectId: event.project_id,
        });

        await client.query("COMMIT");
        const dto = toEventDto(event, attendeeIds);
        emitters.eventCreated(workspaceId, { event: dto });
        emitters.activityCreated(workspaceId, { activity: { kind: "event.created", entityId: event.id, entityLabel: event.title } });
        return dto;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async update(input) {
      const existing = await requireEvent(input.eventId);
      const { data } = input;
      if (data.projectId) {
        const project = await projects.requireProject(data.projectId);
        if (project.workspace_id !== existing.workspace_id) {
          throw httpError.validation("The project does not belong to this workspace.");
        }
      }
      const attendeeIds = data.attendeeIds ? [...new Set(data.attendeeIds)] : undefined;
      if (attendeeIds) {
        await projects.assertMembersInWorkspace(existing.workspace_id, attendeeIds);
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const nextStart = data.start ? new Date(data.start) : existing.start_at;
        const nextEnd = data.end ? new Date(data.end) : existing.end_at;
        if (nextEnd.getTime() <= nextStart.getTime()) {
          throw httpError.validation("The end time must be after the start.");
        }

        const result = await client.query<CalendarEventRow>(
          `UPDATE calendar_events
              SET title = COALESCE($2, title),
                  description = COALESCE($3, description),
                  type = COALESCE($4, type),
                  project_id = CASE WHEN $5::boolean THEN $6 ELSE project_id END,
                  start_at = $7,
                  end_at = $8,
                  all_day = COALESCE($9, all_day),
                  location = COALESCE($10, location),
                  updated_at = now()
            WHERE id = $1
          RETURNING *`,
          [
            input.eventId,
            data.title ?? null,
            data.description ?? null,
            data.type ?? null,
            "projectId" in data,
            data.projectId ?? null,
            nextStart,
            nextEnd,
            data.allDay ?? null,
            data.location ?? null,
          ],
        );
        const event = result.rows[0];
        if (!event) throw httpError.notFound("Event not found.");

        if (attendeeIds) {
          await client.query("DELETE FROM event_attendees WHERE event_id = $1", [input.eventId]);
          for (const attendeeId of attendeeIds) {
            await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [input.eventId, attendeeId]);
          }
        }

        await client.query("COMMIT");
        const attendees = attendeeIds ?? (await attendeeIdsFor(event.id));
        const dto = toEventDto(event, attendees);
        emitters.eventUpdated(existing.workspace_id, { event: dto });
        emitters.activityCreated(existing.workspace_id, { activity: { kind: "event.created", entityId: event.id, entityLabel: event.title } });
        return dto;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async remove(input) {
      const existing = await requireEvent(input.eventId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await logActivity(client, {
          workspaceId: existing.workspace_id,
          actorId: input.actorId,
          kind: "event.created",
          entityType: "event",
          entityId: existing.id,
          entityLabel: existing.title,
          projectId: existing.project_id,
        });
        await client.query("DELETE FROM calendar_events WHERE id = $1", [input.eventId]);
        await client.query("COMMIT");
        emitters.eventDeleted(existing.workspace_id, { eventId: input.eventId });
        emitters.activityCreated(existing.workspace_id, { activity: { kind: "event.created", entityId: input.eventId, entityLabel: existing.title } });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
