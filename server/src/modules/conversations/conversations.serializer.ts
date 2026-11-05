import type { ConversationMemberRow, ConversationRow, MessageRow } from "../../types/rows";
import type { ConversationDto, MessageDto } from "../../types/api";

export function toMessageDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toConversationDto(
  row: ConversationRow,
  members: ConversationMemberRow[],
  messages: MessageRow[],
  unreadCount: number,
): ConversationDto {
  const lastMessage = messages[messages.length - 1];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    name: row.name,
    participantIds: members.map((m) => m.user_id),
    projectId: row.project_id,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          authorId: lastMessage.author_id,
          body: lastMessage.body,
          createdAt: lastMessage.created_at.toISOString(),
        }
      : null,
    unread: unreadCount,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
