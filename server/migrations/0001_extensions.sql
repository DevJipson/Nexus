-- 0001 · Extensions
-- Domain: platform · Applied since Phase 1 (complete-schema-first)
--
-- pgcrypto supplies gen_random_uuid() on PostgreSQL < 13. On PostgreSQL 13+
-- (Neon runs 16/17) it is a harmless no-op because the function is built in.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
