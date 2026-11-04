import type { Pool } from "pg";
import type { Logger } from "../../lib/logger";
import { httpError } from "../../lib/errors";
import { hasRoleAtLeast, type WorkspaceRole } from "../../types/domain";
import type { MemberWithRoleRow, WorkspaceMemberRow, WorkspaceRow } from "../../types/rows";
import type { WorkspaceSummaryDto } from "../../types/api";

/**
 * Workspace service: membership resolution, role authorization, workspace CRUD
 * and member directory. Every other module depends on `requireMembership` /
 * `requireRole`, so tenant isolation is enforced in exactly one place.
 */

export interface WorkspaceServiceOptions {
  pool: Pool;
  logger: Logger;
}

export interface WorkspaceService {
  /** All workspaces the user belongs to, with their role and member count. */
  listForUser(userId: string): Promise<WorkspaceSummaryDto[]>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRow | null>;
  requireMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRow>;
  requireRole(workspaceId: string, userId: string, minimum: WorkspaceRole): Promise<WorkspaceMemberRow>;
  getWorkspace(workspaceId: string): Promise<WorkspaceRow | null>;
  requireWorkspace(workspaceId: string): Promise<WorkspaceRow>;
  createWorkspace(input: { name: string; description?: string; ownerId: string }): Promise<WorkspaceRow>;
  updateWorkspace(workspaceId: string, patch: { name?: string; description?: string }): Promise<WorkspaceRow>;
  softDeleteWorkspace(workspaceId: string): Promise<void>;
  listMembers(workspaceId: string, filters: { query?: string; role?: WorkspaceRole | "all" }): Promise<MemberWithRoleRow[]>;
  countOwners(workspaceId: string): Promise<number>;
  setMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  setActiveWorkspace(userId: string, workspaceId: string): Promise<void>;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

export function createWorkspaceService(options: WorkspaceServiceOptions): WorkspaceService {
  const { pool, logger } = options;

  async function uniqueSlug(base: string): Promise<string> {
    const root = slugify(base);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
      const existing = await pool.query("SELECT 1 FROM workspaces WHERE slug = $1", [candidate]);
      if (existing.rowCount === 0) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  async function requireMembership(workspaceId: string, userId: string): Promise<WorkspaceMemberRow> {
    const result = await pool.query<WorkspaceMemberRow>(
      "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, userId],
    );
    const row = result.rows[0];
    if (!row) {
      // Do not leak whether the workspace exists.
      throw httpError.notFound("Workspace not found.");
    }
    return row;
  }

  async function requireWorkspace(workspaceId: string): Promise<WorkspaceRow> {
    const result = await pool.query<WorkspaceRow>(
      "SELECT * FROM workspaces WHERE id = $1 AND deleted_at IS NULL",
      [workspaceId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Workspace not found.");
    return row;
  }

  return {
    async listForUser(userId) {
      const result = await pool.query<
        WorkspaceRow & { role: WorkspaceRole; member_count: string }
      >(
        `SELECT w.*, wm.role, (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = w.id)::text AS member_count
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE wm.user_id = $1 AND w.deleted_at IS NULL
          ORDER BY w.created_at ASC`,
        [userId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        plan: row.plan,
        description: row.description,
        accentHue: row.accent_hue,
        memberCount: Number(row.member_count),
        role: row.role,
      }));
    },

    getMembership: async (workspaceId, userId) => {
      const result = await pool.query<WorkspaceMemberRow>(
        "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        [workspaceId, userId],
      );
      return result.rows[0] ?? null;
    },

    requireMembership,

    async requireRole(workspaceId, userId, minimum) {
      const membership = await requireMembership(workspaceId, userId);
      if (!hasRoleAtLeast(membership.role, minimum)) {
        throw httpError.forbidden("Your role in this workspace does not permit that action.");
      }
      return membership;
    },

    getWorkspace: async (workspaceId) => {
      const result = await pool.query<WorkspaceRow>(
        "SELECT * FROM workspaces WHERE id = $1 AND deleted_at IS NULL",
        [workspaceId],
      );
      return result.rows[0] ?? null;
    },

    requireWorkspace,

    async createWorkspace(input) {
      const slug = await uniqueSlug(input.name);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const workspace = await client
          .query<WorkspaceRow>(
            `INSERT INTO workspaces (name, slug, description, created_by)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [input.name, slug, input.description ?? "", input.ownerId],
          )
          .then((result) => {
            const row = result.rows[0];
            if (!row) throw httpError.internal();
            return row;
          });

        await client.query(
          "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
          [workspace.id, input.ownerId],
        );

        // Seed the ten fixed frontend labels (mirrors domain-meta.ts hues).
        const labels: Array<[string, number]> = [
          ["design", 280], ["frontend", 264], ["backend", 210], ["research", 168], ["bug", 25],
          ["infra", 235], ["content", 70], ["qa", 340], ["growth", 120], ["ops", 300],
        ];
        for (const [name, hue] of labels) {
          await client.query("INSERT INTO labels (workspace_id, name, hue) VALUES ($1, $2, $3)", [workspace.id, name, hue]);
        }

        await client.query("COMMIT");
        logger.info({ workspaceId: workspace.id, ownerId: input.ownerId }, "workspace created");
        return workspace;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async updateWorkspace(workspaceId, patch) {
      const result = await pool.query<WorkspaceRow>(
        `UPDATE workspaces
            SET name = COALESCE($2, name),
                description = COALESCE($3, description),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
        RETURNING *`,
        [workspaceId, patch.name ?? null, patch.description ?? null],
      );
      const row = result.rows[0];
      if (!row) throw httpError.notFound("Workspace not found.");
      return row;
    },

    async softDeleteWorkspace(workspaceId) {
      const result = await pool.query(
        "UPDATE workspaces SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL",
        [workspaceId],
      );
      if (result.rowCount === 0) throw httpError.notFound("Workspace not found.");
    },

    async listMembers(workspaceId, filters) {
      const result = await pool.query<MemberWithRoleRow>(
        `SELECT u.id, u.email, u.name, u.title, u.bio, u.location, u.timezone, u.avatar_hue, u.avatar_url,
                wm.role, wm.joined_at
           FROM workspace_members wm
           JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = $1 AND u.deleted_at IS NULL
          ORDER BY u.name ASC`,
        [workspaceId],
      );

      const needle = filters.query?.trim().toLowerCase();
      return result.rows.filter((row) => {
        if (filters.role && filters.role !== "all" && row.role !== filters.role) return false;
        if (needle) {
          const haystack = [row.name, row.title, row.email, row.location].join(" ").toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });
    },

    async countOwners(workspaceId) {
      const result = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM workspace_members WHERE workspace_id = $1 AND role = 'owner'",
        [workspaceId],
      );
      return Number(result.rows[0]?.count ?? "0");
    },

    async setMemberRole(workspaceId, userId, role) {
      const result = await pool.query(
        "UPDATE workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2",
        [workspaceId, userId, role],
      );
      if (result.rowCount === 0) throw httpError.notFound("That person is not a member of this workspace.");
    },

    async removeMember(workspaceId, userId) {
      const result = await pool.query(
        "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        [workspaceId, userId],
      );
      if (result.rowCount === 0) throw httpError.notFound("That person is not a member of this workspace.");
    },

    async setActiveWorkspace(userId, workspaceId) {
      await pool.query(
        `INSERT INTO user_preferences (user_id, active_workspace_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET active_workspace_id = EXCLUDED.active_workspace_id`,
        [userId, workspaceId],
      );
    },
  };
}
