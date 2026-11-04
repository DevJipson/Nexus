import type { NotificationRow } from "../../types/rows";
import type { NotificationDto } from "../../types/api";

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read_at !== null,
    createdAt: row.created_at.toISOString(),
  };
}
