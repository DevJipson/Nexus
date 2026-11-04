-- 0008 · Notifications
-- Domain: notifications · Consumed by Phase 4 (delivery) and Phase 5 (badge /
-- dashboard unread counts).
--
-- Decision D8: notifications are PER RECIPIENT (user_id). The frontend's
-- workspace-wide demo records become per-user rows; the bootstrap payload
-- returns only the caller's rows so the UI contract is unchanged.

CREATE TYPE notification_category AS ENUM ('task', 'project', 'team', 'mention', 'system');

CREATE TABLE notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category     notification_category NOT NULL,
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body         text        NOT NULL DEFAULT '' CHECK (char_length(body) <= 500),
  -- In-app deep link relative to the frontend origin, e.g. "/tasks".
  href         text        CHECK (href IS NULL OR char_length(href) <= 500),
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_workspace_created_idx
  ON notifications (user_id, workspace_id, created_at DESC);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;
