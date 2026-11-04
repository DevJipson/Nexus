import type { Pool, PoolClient } from "pg";
import type { NotificationRow } from "../../types/rows";

/**
 * Notification creation and read state.
 *
 * Notifications are per recipient (Decision D8). Feature services call
 * `create` inside their transaction; the recipient's preference is *not*
 * consulted here (in-app notifications are always stored) — email delivery in a
 * later phase honors `user_preferences`.
 */

export interface CreateNotificationInput {
  workspaceId: string;
  userId: string;
  category: "task" | "project" | "team" | "mention" | "system";
  title: string;
  body?: string;
  href?: string | null;
}

export async function createNotification(
  db: Pool | PoolClient,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const result = await db.query<NotificationRow>(
    `INSERT INTO notifications (workspace_id, user_id, category, title, body, href)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.workspaceId, input.userId, input.category, input.title, input.body ?? "", input.href ?? null],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Failed to create notification.");
  return row;
}
