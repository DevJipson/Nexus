import type { Pool, PoolClient } from "pg";
import type { ActivityRow } from "../../types/rows";

/**
 * Activity logging.
 *
 * Every mutation writes an activity row **inside the caller's transaction**
 * (mirrors `logActivity` in the frontend store). Keeping the insert on the same
 * client guarantees the feed never references an entity that failed to commit.
 */

export type ActivityKind =
  | "project.created"
  | "project.updated"
  | "project.completed"
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.assigned"
  | "comment.created"
  | "event.created"
  | "member.joined";

export type ActivityEntityType = "project" | "task" | "event" | "member" | "comment";

export interface LogActivityInput {
  workspaceId: string;
  actorId: string;
  kind: ActivityKind;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  projectId: string | null;
}

/** Inserts an activity row using the provided (transactional) client. */
export async function logActivity(db: Pool | PoolClient, input: LogActivityInput): Promise<ActivityRow> {
  const result = await db.query<ActivityRow>(
    `INSERT INTO activities (workspace_id, actor_id, kind, entity_type, entity_id, entity_label, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.workspaceId,
      input.actorId,
      input.kind,
      input.entityType,
      input.entityId,
      input.entityLabel,
      input.projectId,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Failed to write activity row.");
  return row;
}
