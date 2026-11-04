import type { Pool } from "pg";
import type { Logger } from "../../lib/logger";
import type { Env } from "../../config/env";
import type { EmailTransport } from "../../lib/mail";
import { httpError, isUniqueViolation } from "../../lib/errors";
import { generateToken, hashToken } from "../../lib/tokens";
import type { InvitationRow, WorkspaceMemberRow } from "../../types/rows";
import type { WorkspaceRole } from "../../types/domain";
import type { WorkspaceService } from "../workspaces/workspaces.service";

/**
 * Workspace invitations: invite by email, list pending, revoke, preview and
 * accept. Tokens are random and stored hashed; accepting adds a workspace
 * membership and records a `member.joined` activity.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface InvitationServiceOptions {
  pool: Pool;
  env: Env;
  logger: Logger;
  email: EmailTransport;
  workspaces: WorkspaceService;
}

export interface InvitationService {
  create(input: { workspaceId: string; email: string; role: WorkspaceRole; invitedBy: string; workspaceName: string; inviterName: string }): Promise<InvitationRow>;
  listPending(workspaceId: string): Promise<InvitationRow[]>;
  revoke(workspaceId: string, invitationId: string): Promise<void>;
  preview(token: string): Promise<{ workspaceName: string; inviterName: string; role: WorkspaceRole; email: string }>;
  accept(token: string, userId: string): Promise<WorkspaceMemberRow>;
}

export function createInvitationService(options: InvitationServiceOptions): InvitationService {
  const { pool, env, logger, email, workspaces } = options;

  async function findByToken(token: string): Promise<InvitationRow> {
    const result = await pool.query<InvitationRow>(
      "SELECT * FROM invitations WHERE token_hash = $1",
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("This invitation link is invalid.");
    if (row.status !== "pending") throw httpError.conflict("This invitation is no longer active.");
    if (row.expires_at.getTime() <= Date.now()) {
      await pool.query("UPDATE invitations SET status = 'expired' WHERE id = $1", [row.id]);
      throw httpError.conflict("This invitation has expired.");
    }
    return row;
  }

  return {
    async create(input) {
      const existingMembership = await pool.query(
        `SELECT 1 FROM workspace_members wm
           JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = $1 AND u.email = $2`,
        [input.workspaceId, input.email],
      );
      if (existingMembership.rowCount && existingMembership.rowCount > 0) {
        throw httpError.conflict("That person is already a member of this workspace.");
      }

      const token = generateToken();
      let invitation: InvitationRow;
      try {
        const result = await pool.query<InvitationRow>(
          `INSERT INTO invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [input.workspaceId, input.email, input.role, hashToken(token), input.invitedBy, new Date(Date.now() + INVITE_TTL_MS)],
        );
        const row = result.rows[0];
        if (!row) throw httpError.internal();
        invitation = row;
      } catch (error) {
        if (isUniqueViolation(error)) throw httpError.conflict("An invitation is already pending for that email.");
        throw error;
      }

      const link = `${env.appBaseUrl}/invite?token=${encodeURIComponent(token)}`;
      await email.send({
        to: input.email,
        subject: `${input.inviterName} invited you to ${input.workspaceName} on NEXUS`,
        text: `Hi,\n\n${input.inviterName} invited you to join "${input.workspaceName}" on NEXUS as ${input.role}.\n\nAccept the invitation:\n${link}\n\nThis link expires in 7 days.`,
      });
      logger.info({ invitationId: invitation.id, workspaceId: input.workspaceId }, "invitation created");
      return invitation;
    },

    async listPending(workspaceId) {
      const result = await pool.query<InvitationRow>(
        `SELECT * FROM invitations
          WHERE workspace_id = $1 AND status = 'pending' AND expires_at > now()
          ORDER BY created_at DESC`,
        [workspaceId],
      );
      return result.rows;
    },

    async revoke(workspaceId, invitationId) {
      const result = await pool.query(
        "UPDATE invitations SET status = 'revoked' WHERE id = $1 AND workspace_id = $2 AND status = 'pending'",
        [invitationId, workspaceId],
      );
      if (result.rowCount === 0) throw httpError.notFound("Invitation not found.");
    },

    async preview(token) {
      const invitation = await findByToken(token);
      const workspace = await workspaces.requireWorkspace(invitation.workspace_id);
      let inviterName = "A teammate";
      if (invitation.invited_by) {
        const inviter = await pool.query<{ name: string }>("SELECT name FROM users WHERE id = $1", [invitation.invited_by]);
        inviterName = inviter.rows[0]?.name ?? inviterName;
      }
      return { workspaceName: workspace.name, inviterName, role: invitation.role, email: invitation.email };
    },

    async accept(token, userId) {
      const invitation = await findByToken(token);

      const user = await pool.query<{ email: string }>("SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL", [userId]);
      const accountEmail = user.rows[0]?.email;
      if (!accountEmail) throw httpError.unauthenticated();

      const membership = await pool.connect();
      try {
        await membership.query("BEGIN");
        // The invited email must match the accepting account.
        if (accountEmail !== invitation.email) {
          throw httpError.forbidden(
            `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`,
          );
        }

        const existing = await membership.query<WorkspaceMemberRow>(
          "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
          [invitation.workspace_id, userId],
        );

        let row = existing.rows[0];
        if (!row) {
          const inserted = await membership.query<WorkspaceMemberRow>(
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) RETURNING *",
            [invitation.workspace_id, userId, invitation.role],
          );
          row = inserted.rows[0];
          if (!row) throw httpError.internal();

          await membership.query(
            `INSERT INTO activities (workspace_id, actor_id, kind, entity_type, entity_id, entity_label)
             VALUES ($1, $2, 'member.joined', 'member', $2, $3)`,
            [invitation.workspace_id, userId, accountEmail],
          );
        }

        await membership.query("UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1", [
          invitation.id,
        ]);
        await membership.query("COMMIT");
        return row;
      } catch (error) {
        await membership.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        membership.release();
      }
    },
  };
}
