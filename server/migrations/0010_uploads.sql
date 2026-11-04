-- 0010 · Uploads (file metadata)
-- Domain: files · Reserved by Phase 6 (file uploads).
--
-- Generic object metadata for stored files. Phase 3 writes attachment
-- metadata only; Phase 6 introduces real bytes: uploads rows carry the
-- storage coordinates and attachments.storage_key references uploads.storage_key.

CREATE TABLE uploads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uploader_id     uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_provider text       NOT NULL DEFAULT 'local' CHECK (storage_provider IN ('local', 's3')),
  storage_key     text        NOT NULL UNIQUE,
  name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  size_bytes      bigint      NOT NULL CHECK (size_bytes >= 0),
  mime_type       text        NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 255),
  checksum_sha256 text        CHECK (checksum_sha256 IS NULL OR char_length(checksum_sha256) = 64),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX uploads_workspace_created_idx ON uploads (workspace_id, created_at DESC);
