-- 0002 · Users, sessions, verification tokens, preferences
-- Domain: identity · Consumed by Phase 2 (authentication & authorization)
--
-- One row per human account. Emails are stored lowercase (enforced by CHECK)
-- with a functional unique index for case-insensitive lookups. Users are soft
-- deleted (deleted_at); authored content is preserved via RESTRICT FKs on
-- author/attribution columns elsewhere in the schema.

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text        NOT NULL CHECK (email = lower(email) AND email <> ''),
  -- Argon2id encoded hash (memory=19456 KiB, iterations=2, parallelism=1).
  password_hash     text        NOT NULL,
  name              text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  title             text        NOT NULL DEFAULT '' CHECK (char_length(title) <= 120),
  bio               text        NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  location          text        NOT NULL DEFAULT '' CHECK (char_length(location) <= 120),
  timezone          text        NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) <= 64),
  avatar_hue        smallint    NOT NULL DEFAULT 264 CHECK (avatar_hue BETWEEN 0 AND 360),
  avatar_url        text,
  email_verified_at timestamptz,
  last_seen_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE UNIQUE INDEX users_email_unique_idx ON users (lower(email));

-- Server-side sessions: the cookie carries a random 256-bit token, the
-- database stores only its SHA-256 hash. Logout/password changes revoke.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,
  user_agent   text,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX sessions_user_id_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Single-use tokens for email verification and password reset
-- (token stored hashed; used_at marks consumption).
CREATE TABLE verification_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    text        NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
  token_hash text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_tokens_user_idx ON verification_tokens (user_id, purpose);

-- 1:1 mirror of the frontend `Preferences` shape (domain.ts). Mirrors are kept
-- in sync by tests in later phases.
CREATE TABLE user_preferences (
  user_id                    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  density                    text     NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  reduce_motion              boolean  NOT NULL DEFAULT false,
  start_of_week              smallint NOT NULL DEFAULT 1 CHECK (start_of_week IN (0, 1)),
  email_digest               boolean  NOT NULL DEFAULT true,
  notify_task_assigned       boolean  NOT NULL DEFAULT true,
  notify_comments_mentions   boolean  NOT NULL DEFAULT true,
  notify_due_date_reminders  boolean  NOT NULL DEFAULT true,
  notify_project_updates     boolean  NOT NULL DEFAULT false,
  -- Plain uuid (no FK): workspaces are created in 0003. Validated at the
  -- application layer against workspace membership when written.
  active_workspace_id        uuid
);
