/**
 * Domain enums mirrored from the frontend `src/types/domain.ts`.
 * Kept in one place so validation schemas, DTOs and serializers never drift.
 */

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type Presence = "online" | "away" | "offline";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

/** Relative privilege of each role; higher can do everything a lower role can. */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function hasRoleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
