-- 0009 · Activities (audit history / activity feed)
-- Domain: activity · Consumed by Phase 3 (feed endpoints) and Phase 4
-- (activity:created socket events).
--
-- Every mutation writes an activity row in the same transaction (mirrors
-- logActivity in the frontend store). `entity_label` is denormalized so the
-- feed stays meaningful after the entity is deleted or soft-deleted.

CREATE TYPE activity_kind AS ENUM (
  'project.created',
  'project.updated',
  'project.completed',
  'task.created',
  'task.updated',
  'task.completed',
  'task.assigned',
  'comment.created',
  'event.created',
  'member.joined'
);

CREATE TABLE activities (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id     uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind         activity_kind NOT NULL,
  -- Superset of the frontend union ("project" | "task" | "event"); "member"
  -- and "comment" support member.joined / comment.created attribution later.
  entity_type  text         NOT NULL CHECK (entity_type IN ('project', 'task', 'event', 'member', 'comment')),
  entity_id    uuid         NOT NULL,
  entity_label text         NOT NULL DEFAULT '' CHECK (char_length(entity_label) <= 300),
  project_id   uuid         REFERENCES projects(id) ON DELETE SET NULL,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX activities_workspace_created_idx ON activities (workspace_id, created_at DESC);
CREATE INDEX activities_project_created_idx   ON activities (project_id, created_at DESC);
CREATE INDEX activities_entity_idx            ON activities (entity_type, entity_id);
