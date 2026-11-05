import type { Pool } from "pg";
import { httpError } from "../../lib/errors";
import type { WorkspaceService } from "../workspaces/workspaces.service";
import {
  type ConversationRow,
  type ConversationMemberRow,
  type MessageRow,
} from "../../types/rows";
import type { ConversationDto, MessageDto } from "../../types/api";
import { toConversationDto, toMessageDto } from "./conversations.serializer";
import { emitConversationEvent, emitters } from "../../sockets/emitters";

/**
 * Conversation service.
 *
 * Security rules:
 * - Every operation verifies that the caller is a member of the workspace and
 *  , for workspace conversations, a participant of the conversation. The
 *   caller always proves their identity via the session, never by id passed
 *   from the client.
 * - Direct-conversation dedupe uses the sorted pair key; no duplicate direct
 *   threads can be created.
 * - Messages are inserted and the conversation's last-read state is updated in
 *   one database transaction; socket fan-out happens after commit.
 */

export interface ConversationService {
  listForWorkspace(workspaceId: string, viewerId: string): Promise<ConversationDto[]>;
  create(input: {
    workspaceId: string;
    actorId: string;
    kind: "direct" | "group";
    name?: string | null;
    participantIds: string[];
    projectId?: string | null;
    firstMessage?: string;
  }): Promise<ConversationDto>;
  listMessages(conversationId: string, userId: string, options?: { before?: string; limit?: number }): Promise<{ messages: MessageRow[]; hasMore: boolean }>;
  sendMessage(conversationId: string, userId: string, body: string): Promise<MessageDto>;
  markRead(conversationId: string, userId: string): Promise<void>;
  getLastReadAt(conversationId: string, userId: string): Promise<Date | null>;
  requireConversationForWorkspace(conversationId: string, workspaceId: string): Promise<ConversationRow>;
  requireConversationMembership(conversationId: string, userId: string): Promise<ConversationMemberRow>;
  requireConversationAccess(conversationId: string, userId: string): Promise<ConversationRow>;
}

export function createConversationService(options: {
  pool: Pool;
  workspaces: WorkspaceService;
}): ConversationService {
  const { pool, workspaces } = options;

  async function requireConversationMembership(conversationId: string, userId: string): Promise<ConversationMemberRow> {
    const result = await pool.query<ConversationMemberRow>(
      "SELECT * FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Conversation not found.");
    return row;
  }

  async function assertConversation(conversationId: string, userId: string): Promise<ConversationRow> {
    const result = await pool.query<ConversationRow>(
      "SELECT * FROM conversations WHERE id = $1",
      [conversationId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Conversation not found.");
    await workspaces.requireMembership(row.workspace_id, userId);
    await requireConversationMembership(conversationId, userId);
    return row;
  }

  const requireConversationAccess = assertConversation;

  async function requireConversationForWorkspace(conversationId: string, workspaceId: string): Promise<ConversationRow> {
    const result = await pool.query<ConversationRow>(
      "SELECT * FROM conversations WHERE id = $1 AND workspace_id = $2",
      [conversationId, workspaceId],
    );
    const row = result.rows[0];
    if (!row) throw httpError.notFound("Conversation not found.");
    return row;
  }

  async function membersFor(conversationId: string): Promise<ConversationMemberRow[]> {
    const result = await pool.query<ConversationMemberRow>(
      "SELECT * FROM conversation_members WHERE conversation_id = $1 ORDER BY joined_at ASC",
      [conversationId],
    );
    return result.rows;
  }

  async function lastMessageFor(conversationId: string): Promise<MessageRow | undefined> {
    const result = await pool.query<MessageRow>(
      "SELECT * FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [conversationId],
    );
    return result.rows[0];
  }

  async function unreadCountFor(conversationId: string, viewerId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM messages m
         JOIN conversation_members cm
           ON cm.conversation_id = m.conversation_id
        WHERE m.conversation_id = $1
          AND cm.user_id = $2
          AND m.author_id <> $2
          AND m.created_at > cm.last_read_at
          AND m.deleted_at IS NULL`,
      [conversationId, viewerId],
    );
    return Number(result.rows[0]?.count ?? "0");
  }

  async function validateParticipants(workspaceId: string, viewerId: string, participantIds: string[]): Promise<string[]> {
    // `participantIds` holds the OTHER participants; the creator is always added.
    const unique = [...new Set(participantIds)];
    if (unique.length < 1) throw httpError.validation("Choose at least one other person.");
    // Always include the creator.
    const all = [...new Set([viewerId, ...unique])];
    const result = await pool.query<{ user_id: string }>(
      "SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])",
      [workspaceId, all],
    );
    if (result.rowCount !== all.length) {
      throw httpError.validation("One or more participants are not in this workspace.");
    }
    return all;
  }

  return {
    async listForWorkspace(workspaceId, viewerId) {
      await workspaces.requireMembership(workspaceId, viewerId);
      const result = await pool.query<ConversationRow>(
        `SELECT c.*
           FROM conversations c
           JOIN conversation_members cm ON cm.conversation_id = c.id
          WHERE c.workspace_id = $1 AND cm.user_id = $2
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
        [workspaceId, viewerId],
      );
      if (result.rows.length === 0) return [];

      const ids = result.rows.map((r) => r.id);

      const lastResult = await pool.query<MessageRow>(
        `SELECT DISTINCT ON (conversation_id) conversation_id, id, author_id, body, created_at, updated_at, deleted_at
           FROM messages
          WHERE conversation_id = ANY($1::uuid[]) AND deleted_at IS NULL
          ORDER BY conversation_id, created_at DESC`,
        [ids],
      );
      const lastByConversation = new Map(lastResult.rows.map((m) => [m.conversation_id, m]));

      const unreadResult = await pool.query<{ conversation_id: string; count: string }>(
        `SELECT cm.conversation_id, count(*)::text AS count
           FROM conversation_members cm
           JOIN messages m ON m.conversation_id = cm.conversation_id
          WHERE cm.conversation_id = ANY($1::uuid[])
            AND cm.user_id = $2
            AND m.author_id <> $2
            AND m.deleted_at IS NULL
            AND m.created_at > cm.last_read_at
          GROUP BY cm.conversation_id`,
        [ids, viewerId],
      );
      const unreadByConversation = new Map(unreadResult.rows.map((r) => [r.conversation_id, Number(r.count)]));

      const memberResult = await pool.query<ConversationMemberRow>(
        "SELECT * FROM conversation_members WHERE conversation_id = ANY($1::uuid[]) ORDER BY joined_at ASC",
        [ids],
      );
      const membersByConversation = new Map<string, ConversationMemberRow[]>();
      for (const m of memberResult.rows) {
        const arr = membersByConversation.get(m.conversation_id) ?? [];
        arr.push(m);
        membersByConversation.set(m.conversation_id, arr);
      }

      return result.rows.map((row) =>
        toConversationDto(
          row,
          membersByConversation.get(row.id) ?? [],
          lastByConversation.get(row.id) ? [lastByConversation.get(row.id)!] : [],
          unreadByConversation.get(row.id) ?? 0,
        ),
      );
    },

    async create(input) {
      const { workspaceId, actorId, kind, name, participantIds, projectId, firstMessage } = input;
      await workspaces.requireMembership(workspaceId, actorId);

      if (projectId) {
        const project = await pool.query<{ workspace_id: string }>(
          "SELECT id, workspace_id FROM projects WHERE id = $1 AND deleted_at IS NULL",
          [projectId],
        );
        const projectRow = project.rows[0];
        if (!projectRow || projectRow.workspace_id !== workspaceId) {
          throw httpError.validation("The project does not belong to this workspace.");
        }
      }

      const all = await validateParticipants(workspaceId, actorId, participantIds);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        let row: ConversationRow | undefined;
        let insertedMessage: MessageRow | undefined;
        let conversationCreated = false;
        // Documented format: `${workspaceId}:${smallerUserId}:${largerUserId}`.
        const directKey = kind === "direct" ? `${workspaceId}:${[...all].sort().join(":")}` : null;
        if (kind === "direct") {
          if (all.length !== 2) throw httpError.validation("A direct message needs exactly one person.");
          const existing = await client.query<ConversationRow>(
            "SELECT * FROM conversations WHERE direct_key = $1",
            [directKey],
          );
          row = existing.rows[0];
        } else {
          if (!name || name.trim().length < 2) throw httpError.validation("Group name must be at least 2 characters.");
        }

        if (!row) {
          const inserted = await client.query<ConversationRow>(
            `INSERT INTO conversations (workspace_id, kind, name, project_id, direct_key, created_by, last_message_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
             RETURNING *`,
            [
              workspaceId,
              kind,
              kind === "group" ? name?.trim() : null,
              projectId ?? null,
              kind === "direct" ? directKey : null,
              actorId,
              firstMessage ? new Date() : null,
            ],
          );
          row = inserted.rows[0];
          if (!row) throw httpError.internal();
          conversationCreated = true;

          for (const member of all) {
            if (member === actorId) {
              await client.query(
                "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
                [row.id, member],
              );
            } else {
              // "Never read" sentinel so a firstMessage created in this same
              // transaction counts as unread for the other participants.
              await client.query(
                "INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES ($1, $2, $3)",
                [row.id, member, new Date(0)],
              );
            }
          }
        }

        if (firstMessage && firstMessage.trim()) {
          const msg = await client.query<MessageRow>(
            `INSERT INTO messages (conversation_id, author_id, body, created_at, updated_at)
             VALUES ($1, $2, $3, now(), now())
             RETURNING *`,
            [row.id, actorId, firstMessage.trim()],
          );
          const message = msg.rows[0];
          if (message) {
            insertedMessage = message;
            await client.query("UPDATE conversations SET last_message_at = $1, updated_at = now() WHERE id = $2", [
              message.created_at,
              row.id,
            ]);
            await client.query(
              `INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
              [row.id, actorId, message.created_at],
            );
          }
        }

        await client.query("COMMIT");

        // Re-read so the DTO reflects the conversation's final state (a first
        // message updates last_message_at / updated_at).
        const fresh = await pool.query<ConversationRow>("SELECT * FROM conversations WHERE id = $1", [row.id]);
        row = fresh.rows[0] ?? row;
        const members = await membersFor(row.id);
        const last = await lastMessageFor(row.id);
        const unread = await unreadCountFor(row.id, actorId);
        const dto = toConversationDto(row, members, last ? [last] : [], unread);
        if (insertedMessage) {
          emitConversationEvent(row.id, "message:new", {
            message: toMessageDto(insertedMessage),
            senderId: actorId,
            recipientIds: members.map((member) => member.user_id),
          });
        }
        if (conversationCreated) {
          // Notify every participant's personal room — they may not have joined
          // the conversation room yet, so they learn about the thread here.
          for (const member of members) {
            emitters.conversationNew(member.user_id, { conversation: dto });
          }
        }
        return dto;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async listMessages(conversationId, userId, options = {}) {
      await assertConversation(conversationId, userId);
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
      const values: unknown[] = [conversationId];
      let condition = "conversation_id = $1 AND deleted_at IS NULL";
      if (options.before) {
        values.push(new Date(options.before));
        condition += ` AND created_at < $${values.length}`;
      }
      values.push(limit + 1);

      const result = await pool.query<MessageRow>(
        `SELECT * FROM messages WHERE ${condition}
          ORDER BY created_at DESC
          LIMIT $${values.length}`,
        values,
      );
      const rows = result.rows.slice(0, limit);
      const hasMore = result.rows.length > limit;
      rows.reverse();
      return { messages: rows, hasMore };
    },

    async sendMessage(conversationId, userId, body) {
      await assertConversation(conversationId, userId);
      const msg = body.trim();
      if (!msg) throw httpError.validation("Write something first.");
      if (msg.length > 4000) throw httpError.validation("Message is too long.");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<MessageRow>(
          `INSERT INTO messages (conversation_id, author_id, body, created_at, updated_at)
           VALUES ($1, $2, $3, now(), now())
           RETURNING *`,
          [conversationId, userId, msg],
        );
        const message = result.rows[0];
        if (!message) throw httpError.internal();

        await client.query("UPDATE conversations SET last_message_at = $1, updated_at = now() WHERE id = $2", [message.created_at, conversationId]);
        await client.query(
          `INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
          [conversationId, userId, message.created_at],
        );

        const rows = await client.query<ConversationMemberRow>(
          "SELECT * FROM conversation_members WHERE conversation_id = $1",
          [conversationId],
        );

        await client.query("COMMIT");

        const dto = toMessageDto(message);
        emitConversationEvent(conversationId, "message:new", {
          message: dto,
          senderId: userId,
          recipientIds: rows.rows.map((r) => r.user_id),
        });

        return dto;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async markRead(conversationId, userId) {
      await assertConversation(conversationId, userId);
      await pool.query(
        "UPDATE conversation_members SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId],
      );
    },

    async getLastReadAt(conversationId, userId) {
      await assertConversation(conversationId, userId);
      const result = await pool.query<{ last_read_at: Date }>(
        "SELECT last_read_at FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId],
      );
      return result.rows[0]?.last_read_at ?? null;
    },

    requireConversationForWorkspace,
    requireConversationMembership,
    requireConversationAccess,
  };
}
