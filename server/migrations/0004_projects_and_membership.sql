-- 0004 · Projects and project membership
-- Domain: portfolio · Consumed by Phase 3 (core project management).
--
-- `priority` is created here because both projects and tasks (0005) use it.
-- Visibility: all workspace members can read all workspace projects (Decision
-- D11); project_members is the roster behind member pickers and avatar stacks.

CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'archived');
CREATE TYPE priority       AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE projects (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name        text           NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  -- Short human key (frontend `Project.key`, e.g. "ATL"). Server-computed;
  -- unique per workspace.
  key         text           NOT NULL CHECK (key ~ '^[A-Z0-9]{1,10}$'),
  description text           NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  status      project_status NOT NULL DEFAULT 'planning',
  priority    priority       NOT NULL DEFAULT 'medium',
  color_hue   smallint       NOT NULL DEFAULT 264 CHECK (color_hue BETWEEN 0 AND 360),
  start_date  timestamptz    NOT NULL DEFAULT now(),
  due_date    timestamptz    NOT NULL,
  created_by  uuid           REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (workspace_id, key)
);

CREATE INDEX projects_workspace_updated_idx ON projects (workspace_id, updated_at DESC);
CREATE INDEX projects_workspace_due_idx     ON projects (workspace_id, due_date);
CREATE INDEX projects_workspace_status_idx  ON projects (workspace_id, status);

CREATE TABLE project_members (
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_id_idx ON project_members (user_id);
