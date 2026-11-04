-- 0007 · Conversations, conversation membership, messages
-- Domain: messaging · Consumed by Phase 4 (real-time collaboration).
--
-- - `direct_key` dedupes direct conversations: `${workspaceId}:${smallerUserId}
--   :${largerUserId}` with a partial unique index, so a DM pair can only ever
--   exist once per workspace (Decision D12).
-- - Read receipts are per member (conversation_members.last_read_at) — the
--   correct generalization of the frontend's single `Conversation.lastReadAt`.
-- - Deleting a project detaches conversations (project_id → NULL), matching
--   the frontend store's deleteProject behavior.

CREATE TYPE conversation_kind AS ENUM ('direct', 'group');

CREATE TABLE conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind            conversation_kind NOT NULL,
  -- Required for groups (CHECK), always NULL for direct conversations (app rule).
  name            text        CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 120),
  project_id      uuid        REFERENCES projects(id) ON DELETE SET NULL,
  direct_key      text,
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  -- Denormalized for list ordering (frontend sorts threads by last message).
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_group_name_check CHECK (kind <> 'group' OR name IS NOT NULL)
);

CREATE UNIQUE INDEX conversations_direct_key_idx
  ON conversations (direct_key)
  WHERE kind = 'direct' AND direct_key IS NOT NULL;

CREATE INDEX conversations_workspace_last_message_idx
  ON conversations (workspace_id, last_message_at DESC NULLS LAST);

CREATE INDEX conversations_project_id_idx ON conversations (project_id);

CREATE TABLE conversation_members (
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_members_user_id_idx ON conversation_members (user_id);

CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX messages_author_idx               ON messages (author_id);
