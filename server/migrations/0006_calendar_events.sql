-- 0006 · Calendar events and attendees
-- Domain: calendar · Consumed by Phase 3 (events CRUD) and Phase 5 (calendar
-- range queries / dashboard agenda).
--
-- Deleting a project detaches its events (project_id → NULL), mirroring the
-- frontend store's deleteProject behavior exactly.

CREATE TYPE event_type AS ENUM ('meeting', 'deadline', 'milestone', 'focus');

CREATE TABLE calendar_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  type        event_type  NOT NULL,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  all_day     boolean     NOT NULL DEFAULT false,
  location    text        NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_check CHECK (end_at > start_at)
);

CREATE INDEX calendar_events_workspace_start_idx ON calendar_events (workspace_id, start_at);
CREATE INDEX calendar_events_project_id_idx      ON calendar_events (project_id);

CREATE TABLE event_attendees (
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX event_attendees_user_id_idx ON event_attendees (user_id);
