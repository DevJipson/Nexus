-- 0003 · Workspaces, workspace membership, invitations
-- Domain: tenancy · Consumed by Phase 2 (workspace authorization) and used by
-- every later phase. This table pair is the tenant boundary: every other
-- tenant-owned row carries workspace_id and every query filters by it.

CREATE TYPE workspace_role   AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE workspaces (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug        text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Display-only plan label matching the frontend ("Studio" | "Team" | "Personal").
  plan        text        NOT NULL DEFAULT 'Team' CHECK (plan IN ('Studio', 'Team', 'Personal')),
  description text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  accent_hue  smallint    NOT NULL DEFAULT 264 CHECK (accent_hue BETWEEN 0 AND 360),
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX workspaces_created_by_idx ON workspaces (created_by);

-- Membership = the authorization record. Role is per workspace (the frontend's
-- flat `Member.role` is resolved against the active workspace by the API).
-- The last owner of a live workspace cannot be demoted/removed (app rule).
CREATE TABLE workspace_members (
  workspace_id uuid           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'member',
  joined_at    timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_id_idx ON workspace_members (user_id);

-- Email invitations (frontend "Invite teammate" flow). Token stored hashed.
CREATE TABLE invitations (
  id           uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid              NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text              NOT NULL CHECK (email = lower(email) AND email <> ''),
  role         workspace_role    NOT NULL DEFAULT 'member',
  token_hash   text              NOT NULL UNIQUE,
  invited_by   uuid              REFERENCES users(id) ON DELETE SET NULL,
  status       invitation_status NOT NULL DEFAULT 'pending',
  expires_at   timestamptz       NOT NULL,
  accepted_at  timestamptz,
  created_at   timestamptz       NOT NULL DEFAULT now()
);

-- One pending invitation per workspace/email.
CREATE UNIQUE INDEX invitations_workspace_email_pending_idx
  ON invitations (workspace_id, email)
  WHERE status = 'pending';

CREATE INDEX invitations_workspace_idx ON invitations (workspace_id);
