-- 0005 · Tasks, labels, subtasks, comments, attachments
-- Domain: work management · Consumed by Phase 3 (core project management).
--
-- Notes:
-- - `sort_order` is the kanban position within (workspace_id, status). The API
--   serializes it as `order` (the frontend field name); the column is named
--   sort_order because ORDER is a reserved SQL word.
-- - `move` semantics mirror the frontend store exactly: PATCH position with
--   {status, index} renumbers the affected column 1..n in one transaction.
-- - Labels follow Decision D3: a per-workspace catalog (seeded with the ten
--   fixed frontend labels) joined through task_labels, so custom labels can be
--   added later without schema changes.

CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done');

CREATE TABLE labels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  hue          smallint    NOT NULL DEFAULT 264 CHECK (hue BETWEEN 0 AND 360),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalized tenant key (mirrors the frontend `Task.workspaceId`) so
  -- workspace scoping never requires a join through projects.
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description  text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  status       task_status NOT NULL DEFAULT 'todo',
  priority     priority    NOT NULL DEFAULT 'medium',
  assignee_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  reporter_id  uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_date     timestamptz,
  sort_order   double precision NOT NULL DEFAULT 1 CHECK (sort_order >= 0),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX tasks_workspace_status_sort_idx ON tasks (workspace_id, status, sort_order);
CREATE INDEX tasks_project_id_idx            ON tasks (project_id);
CREATE INDEX tasks_assignee_idx              ON tasks (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX tasks_workspace_due_idx         ON tasks (workspace_id, due_date);
CREATE INDEX tasks_workspace_created_idx     ON tasks (workspace_id, created_at DESC);

CREATE TABLE task_labels (
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  -- CASCADE: removing a label (or its workspace) removes the join rows; the
  -- RESTRICT variant would block workspace cascade deletion.
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE INDEX task_labels_label_id_idx ON task_labels (label_id);

CREATE TABLE subtasks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  done       boolean     NOT NULL DEFAULT false,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subtasks_task_id_idx ON subtasks (task_id, sort_order);

CREATE TABLE comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  -- RESTRICT: comment attribution survives account deletion (the frontend
  -- already renders an "Unknown" fallback).
  author_id  uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX comments_task_id_idx ON comments (task_id, created_at);

-- Phase 3 stores metadata only (name/size/mime) exactly like the frontend
-- today; Phase 6 adds real bytes via `uploads` and populates storage_key.
CREATE TABLE attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  size_bytes  bigint      NOT NULL CHECK (size_bytes >= 0),
  mime_type   text        NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 255),
  storage_key text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attachments_task_id_idx ON attachments (task_id);
