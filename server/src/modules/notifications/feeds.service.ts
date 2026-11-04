import type { Pool } from "pg";
import { httpError } from "../../lib/errors";
import type { ActivityRow, NotificationRow } from "../../types/rows";
import type { ActivityDto, NotificationDto } from "../../types/api";
import { toActivityDto } from "../projects/work.serializer";
import { toNotificationDto } from "./notifications.serializer";

/**
 * Read-side services for feeds: workspace activity and per-recipient
 * notifications. Both are workspace-scoped; the caller's membership is verified
 * in the controller before these run.
 */

export interface FeedService {
  listActivity(workspaceId: string, filters: { projectId?: string; limit?: number; before?: string }): Promise<ActivityDto[]>;
  listNotifications(
    workspaceId: string,
    userId: string,
    filters: { unreadOnly?: boolean; limit?: number },
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number }>;
  markNotificationRead(notificationId: string, userId: string): Promise<NotificationDto>;
  markAllNotificationsRead(workspaceId: string, userId: string): Promise<number>;
}

export function createFeedService(options: { pool: Pool }): FeedService {
  const { pool } = options;

  return {
    async listActivity(workspaceId, filters) {
      const conditions = ["workspace_id = $1"];
      const values: unknown[] = [workspaceId];
      if (filters.projectId) {
        values.push(filters.projectId);
        conditions.push(`project_id = $${values.length}`);
      }
      if (filters.before) {
        values.push(new Date(filters.before));
        conditions.push(`created_at < $${values.length}`);
      }
      values.push(Math.min(filters.limit ?? 50, 100));
      const result = await pool.query<ActivityRow>(
        `SELECT * FROM activities WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(toActivityDto);
    },

    async listNotifications(workspaceId, userId, filters) {
      const conditions = ["workspace_id = $1", "user_id = $2"];
      const values: unknown[] = [workspaceId, userId];
      if (filters.unreadOnly) conditions.push("read_at IS NULL");
      values.push(Math.min(filters.limit ?? 50, 100));

      const result = await pool.query<NotificationRow>(
        `SELECT * FROM notifications WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length}`,
        values,
      );
      const unread = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM notifications WHERE workspace_id = $1 AND user_id = $2 AND read_at IS NULL",
        [workspaceId, userId],
      );
      return {
        notifications: result.rows.map(toNotificationDto),
        unreadCount: Number(unread.rows[0]?.count ?? "0"),
      };
    },

    async markNotificationRead(notificationId, userId) {
      const result = await pool.query<NotificationRow>(
        `UPDATE notifications SET read_at = COALESCE(read_at, now())
          WHERE id = $1 AND user_id = $2
        RETURNING *`,
        [notificationId, userId],
      );
      const row = result.rows[0];
      if (!row) throw httpError.notFound("Notification not found.");
      return toNotificationDto(row);
    },

    async markAllNotificationsRead(workspaceId, userId) {
      const result = await pool.query(
        "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE workspace_id = $1 AND user_id = $2 AND read_at IS NULL",
        [workspaceId, userId],
      );
      return result.rowCount ?? 0;
    },
  };
}
