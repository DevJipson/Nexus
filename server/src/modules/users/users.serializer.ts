import type { UserDto, PreferencesDto, MemberDto } from "../../types/api";
import type { MemberWithRoleRow, UserPreferencesRow, UserRow } from "../../types/rows";
import type { Presence } from "../../types/domain";

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    title: row.title,
    bio: row.bio,
    location: row.location,
    timezone: row.timezone,
    avatarHue: row.avatar_hue,
    avatarUrl: row.avatar_url,
    emailVerified: row.email_verified_at !== null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toPreferencesDto(row: UserPreferencesRow): PreferencesDto {
  return {
    density: row.density,
    reduceMotion: row.reduce_motion,
    startOfWeek: row.start_of_week === 1 ? 1 : 0,
    emailDigest: row.email_digest,
    taskAssigned: row.notify_task_assigned,
    commentsMentions: row.notify_comments_mentions,
    dueDateReminders: row.notify_due_date_reminders,
    projectUpdates: row.notify_project_updates,
  };
}

/**
 * Presence is simulated in Phase 2 (nobody can be observed yet); Phase 4
 * replaces this with the live presence registry. Seeding a stable default keeps
 * the member directory meaningful in the meantime.
 */
export function defaultPresence(): Presence {
  return "offline";
}

export function toMemberDto(row: MemberWithRoleRow, workspaceId: string, presence: Presence = defaultPresence()): MemberDto {
  return {
    id: row.id,
    workspaceIds: [workspaceId],
    name: row.name,
    email: row.email,
    role: row.role,
    title: row.title,
    bio: row.bio,
    presence,
    timezone: row.timezone,
    location: row.location,
    avatarHue: row.avatar_hue,
    joinedAt: row.joined_at.toISOString(),
  };
}
