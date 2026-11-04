import type { Pool } from "pg";
import type { Logger } from "../../lib/logger";
import { httpError, isUniqueViolation } from "../../lib/errors";
import { hashPassword, verifyPassword } from "../../lib/passwords";
import type { UserRow, UserPreferencesRow } from "../../types/rows";
import type { UpdatePreferencesBody, UpdateProfileBody } from "../auth/auth.schemas";
import { toPreferencesDto, toUserDto } from "./users.serializer";
import type { PreferencesDto, UserDto } from "../../types/api";

/**
 * User profile + preferences. Owns the users and user_preferences tables so
 * other modules never write them directly.
 */

export interface UserServiceOptions {
  pool: Pool;
  logger: Logger;
}

export interface UserService {
  getPreferences(userId: string): Promise<UserPreferencesRow>;
  updateProfile(user: UserRow, patch: UpdateProfileBody): Promise<{ user: UserDto; emailChanged: boolean }>;
  updatePreferences(userId: string, patch: UpdatePreferencesBody): Promise<PreferencesDto>;
  getActiveWorkspaceId(userId: string): Promise<string | null>;
}

export function createUserService(options: UserServiceOptions): UserService {
  const { pool } = options;

  async function ensurePreferences(userId: string): Promise<UserPreferencesRow> {
    const result = await pool.query<UserPreferencesRow>(
      `INSERT INTO user_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.internal();
    return row;
  }

  return {
    getPreferences: ensurePreferences,

    async updateProfile(user, patch) {
      const emailChanged = patch.email !== undefined && patch.email !== user.email;

      const result = await pool.query<UserRow>(
        `UPDATE users
            SET name = COALESCE($2, name),
                title = COALESCE($3, title),
                bio = COALESCE($4, bio),
                location = COALESCE($5, location),
                timezone = COALESCE($6, timezone),
                email = COALESCE($7, email),
                email_verified_at = CASE WHEN $7 IS NOT NULL AND $7 <> email THEN NULL ELSE email_verified_at END,
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
        RETURNING *`,
        [
          user.id,
          patch.name ?? null,
          patch.title ?? null,
          patch.bio ?? null,
          patch.location ?? null,
          patch.timezone ?? null,
          patch.email ?? null,
        ],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw httpError.conflict("That email is already in use.");
        }
        throw error;
      });

      const row = result.rows[0];
      if (!row) throw httpError.notFound("User not found.");

      return { user: toUserDto(row), emailChanged };
    },

    async updatePreferences(userId, patch) {
      await ensurePreferences(userId);
      const result = await pool.query<UserPreferencesRow>(
        `UPDATE user_preferences
            SET density = COALESCE($2, density),
                reduce_motion = COALESCE($3, reduce_motion),
                start_of_week = COALESCE($4, start_of_week),
                email_digest = COALESCE($5, email_digest),
                notify_task_assigned = COALESCE($6, notify_task_assigned),
                notify_comments_mentions = COALESCE($7, notify_comments_mentions),
                notify_due_date_reminders = COALESCE($8, notify_due_date_reminders),
                notify_project_updates = COALESCE($9, notify_project_updates)
          WHERE user_id = $1
        RETURNING *`,
        [
          userId,
          patch.density ?? null,
          patch.reduceMotion ?? null,
          patch.startOfWeek ?? null,
          patch.emailDigest ?? null,
          patch.taskAssigned ?? null,
          patch.commentsMentions ?? null,
          patch.dueDateReminders ?? null,
          patch.projectUpdates ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) throw httpError.internal();
      return toPreferencesDto(row);
    },

    async getActiveWorkspaceId(userId) {
      const row = await ensurePreferences(userId);
      return row.active_workspace_id;
    },
  };
}

// Re-exported to keep hashing imports localized if a caller needs them.
export { hashPassword, verifyPassword };
