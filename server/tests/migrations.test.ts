import pino from "pino";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMigrationFiles, resetSchema, runMigrations } from "../src/db/migrate";

/**
 * Database-backed migration suite.
 *
 * Runs against TEST_DATABASE_URL (a disposable database — resetSchema drops
 * the public schema). Skipped entirely when TEST_DATABASE_URL is unset so
 * `npm test` works without infrastructure.
 */
const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const logger = pino({ level: "silent" });

const EXPECTED_TABLES = [
  "schema_migrations",
  "users", "sessions", "verification_tokens", "user_preferences",
  "workspaces", "workspace_members", "invitations",
  "projects", "project_members",
  "labels", "tasks", "task_labels", "subtasks", "comments", "attachments",
  "calendar_events", "event_attendees",
  "conversations", "conversation_members", "messages",
  "notifications", "activities", "uploads",
] as const;

const EXPECTED_ENUMS = [
  "workspace_role", "invitation_status", "project_status", "priority",
  "task_status", "event_type", "conversation_kind", "notification_category",
  "activity_kind",
] as const;

async function tableCount(pool: Pool, table: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    // Table names come from this file's constants, never user input.
    `SELECT count(*)::text AS count FROM ${table}`,
  );
  const row = result.rows[0];
  if (!row) throw new Error(`count query returned no rows for ${table}`);
  return Number(row.count);
}

suite("migrations", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await resetSchema(pool, logger);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("applies every migration file exactly once and is idempotent", async () => {
    const files = await listMigrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);

    // beforeAll's resetSchema already applied every file; a further run must
    // be a no-op. (The fresh-apply path is exercised by resetSchema itself,
    // which fails loudly if any migration errors.)
    const rerun = await runMigrations(pool, logger);
    expect(rerun.applied).toHaveLength(0);
    expect(rerun.skipped).toBe(files.length);
  });

  it("records applied migrations in schema_migrations", async () => {
    const applied = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    const names = applied.rows.map((row) => row.name);
    expect(names).toContain("0001_extensions.sql");
    expect(names).toContain("0010_uploads.sql");
    expect(names).toHaveLength(await listMigrationFiles().then((files) => files.length));
  });

  it("creates every expected table", async () => {
    const result = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = new Set(result.rows.map((row) => row.table_name));
    for (const table of EXPECTED_TABLES) {
      expect(names.has(table), `missing table: ${table}`).toBe(true);
    }
  });

  it("creates every domain enum type", async () => {
    const result = await pool.query<{ typname: string }>(
      "SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace",
    );
    const names = new Set(result.rows.map((row) => row.typname));
    for (const enumType of EXPECTED_ENUMS) {
      expect(names.has(enumType), `missing enum: ${enumType}`).toBe(true);
    }
  });

  it("supports the full tenant write path and cascades workspace deletion", async () => {
    const insert = async <T>(sql: string, params: unknown[]): Promise<T | undefined> => {
      const result = await pool.query<{ id: string }>(`${sql} RETURNING id`, params);
      return result.rows[0]?.id as T | undefined;
    };

    const userOne = await insert<string>(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      ["one@migration.test", "argon2id$placeholder", "User One"],
    );
    const userTwo = await insert<string>(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      ["two@migration.test", "argon2id$placeholder", "User Two"],
    );
    expect(userOne).toBeTruthy();
    expect(userTwo).toBeTruthy();

    const workspace = await insert<string>(
      "INSERT INTO workspaces (name, slug, created_by) VALUES ($1, $2, $3)",
      ["Cascade Co", "cascade-co", userOne],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')",
      [workspace, userOne, userTwo],
    );
    await pool.query(
      "INSERT INTO user_preferences (user_id, active_workspace_id) VALUES ($1, $2), ($3, $2)",
      [userOne, workspace, userTwo],
    );

    const project = await insert<string>(
      "INSERT INTO projects (workspace_id, name, key, due_date, created_by) VALUES ($1, $2, $3, now() + interval '30 days', $4)",
      [workspace, "Project P", "PJP", userOne],
    );
    await pool.query(
      "INSERT INTO project_members (project_id, user_id) VALUES ($1, $2), ($1, $3)",
      [project, userOne, userTwo],
    );
    const label = await insert<string>(
      "INSERT INTO labels (workspace_id, name) VALUES ($1, $2)",
      [workspace, "design"],
    );
    const task = await insert<string>(
      "INSERT INTO tasks (workspace_id, project_id, title, reporter_id, assignee_id, due_date) VALUES ($1, $2, $3, $4, $5, now() + interval '2 days')",
      [workspace, project, "Task T", userOne, userTwo],
    );
    await pool.query("INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)", [task, label]);
    await pool.query("INSERT INTO subtasks (task_id, title) VALUES ($1, $2)", [task, "Step one"]);
    await pool.query(
      "INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3)",
      [task, userTwo, "Looks good to me."],
    );
    await pool.query(
      "INSERT INTO attachments (task_id, uploaded_by, name, size_bytes, mime_type) VALUES ($1, $2, $3, $4, $5)",
      [task, userOne, "notes.txt", 100, "text/plain"],
    );

    const event = await insert<string>(
      "INSERT INTO calendar_events (workspace_id, project_id, title, type, start_at, end_at) VALUES ($1, $2, $3, 'meeting', now(), now() + interval '1 hour')",
      [workspace, project, "Event E"],
    );
    await pool.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [event, userOne]);

    const conversation = await insert<string>(
      "INSERT INTO conversations (workspace_id, kind, name) VALUES ($1, 'group', $2)",
      [workspace, "Thread C"],
    );
    await pool.query(
      "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [conversation, userOne, userTwo],
    );
    await pool.query(
      "INSERT INTO messages (conversation_id, author_id, body) VALUES ($1, $2, $3)",
      [conversation, userOne, "Hello workspace"],
    );

    await pool.query(
      "INSERT INTO notifications (workspace_id, user_id, category, title) VALUES ($1, $2, 'task', $3)",
      [workspace, userTwo, "Notification N"],
    );
    await pool.query(
      "INSERT INTO activities (workspace_id, actor_id, kind, entity_type, entity_id, entity_label, project_id) VALUES ($1, $2, 'task.created', 'task', $3, 'Task T', $4)",
      [workspace, userOne, task, project],
    );
    await pool.query(
      "INSERT INTO uploads (workspace_id, uploader_id, storage_provider, storage_key, name, size_bytes, mime_type) VALUES ($1, $2, 'local', $3, $4, $5, $6)",
      [workspace, userOne, "local/test-1", "notes.txt", 100, "text/plain"],
    );

    // Row counts before deletion.
    expect(await tableCount(pool, "tasks")).toBe(1);
    expect(await tableCount(pool, "subtasks")).toBe(1);
    expect(await tableCount(pool, "comments")).toBe(1);
    expect(await tableCount(pool, "attachments")).toBe(1);
    expect(await tableCount(pool, "calendar_events")).toBe(1);
    expect(await tableCount(pool, "conversations")).toBe(1);
    expect(await tableCount(pool, "messages")).toBe(1);
    expect(await tableCount(pool, "notifications")).toBe(1);
    expect(await tableCount(pool, "activities")).toBe(1);
    expect(await tableCount(pool, "uploads")).toBe(1);

    // Deleting the workspace cascades every tenant-owned row, users survive.
    await pool.query("DELETE FROM workspaces WHERE id = $1", [workspace]);
    expect(await tableCount(pool, "workspace_members")).toBe(0);
    expect(await tableCount(pool, "projects")).toBe(0);
    expect(await tableCount(pool, "labels")).toBe(0);
    expect(await tableCount(pool, "tasks")).toBe(0);
    expect(await tableCount(pool, "task_labels")).toBe(0);
    expect(await tableCount(pool, "calendar_events")).toBe(0);
    expect(await tableCount(pool, "conversations")).toBe(0);
    expect(await tableCount(pool, "messages")).toBe(0);
    expect(await tableCount(pool, "notifications")).toBe(0);
    expect(await tableCount(pool, "activities")).toBe(0);
    expect(await tableCount(pool, "uploads")).toBe(0);
    expect(await tableCount(pool, "user_preferences")).toBe(2);
    expect(await tableCount(pool, "users")).toBe(2);
  });

  it("detaches events, conversations and activities from deleted projects (SET NULL)", async () => {
    const insert = async (sql: string, params: unknown[]): Promise<string | undefined> => {
      const result = await pool.query<{ id: string }>(`${sql} RETURNING id`, params);
      return result.rows[0]?.id;
    };

    const user = await insert(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      ["detach@migration.test", "argon2id$placeholder", "Detach User"],
    );
    const workspace = await insert(
      "INSERT INTO workspaces (name, slug, created_by) VALUES ($1, $2, $3)",
      ["Detach Co", "detach-co", user],
    );
    const project = await insert(
      "INSERT INTO projects (workspace_id, name, key, due_date, created_by) VALUES ($1, $2, $3, now() + interval '10 days', $4)",
      [workspace, "Doomed", "DOOM", user],
    );
    const event = await insert(
      "INSERT INTO calendar_events (workspace_id, project_id, title, type, start_at, end_at) VALUES ($1, $2, $3, 'deadline', now(), now() + interval '1 hour')",
      [workspace, project, "Detach event"],
    );
    const conversation = await insert(
      "INSERT INTO conversations (workspace_id, project_id, kind, name) VALUES ($1, $2, 'group', $3)",
      [workspace, project, "Detach thread"],
    );
    const activity = await insert(
      "INSERT INTO activities (workspace_id, actor_id, kind, entity_type, entity_id, entity_label, project_id) VALUES ($1, $2, 'project.updated', 'project', $3, 'Doomed', $3)",
      [workspace, user, project],
    );

    await pool.query("DELETE FROM projects WHERE id = $1", [project]);

    const eventRow = await pool.query<{ project_id: string | null }>(
      "SELECT project_id FROM calendar_events WHERE id = $1", [event],
    );
    const conversationRow = await pool.query<{ project_id: string | null }>(
      "SELECT project_id FROM conversations WHERE id = $1", [conversation],
    );
    const activityRow = await pool.query<{ project_id: string | null }>(
      "SELECT project_id FROM activities WHERE id = $1", [activity],
    );
    expect(eventRow.rows[0]?.project_id).toBeNull();
    expect(conversationRow.rows[0]?.project_id).toBeNull();
    expect(activityRow.rows[0]?.project_id).toBeNull();
  });

  it("allows only one direct conversation per user pair (direct_key unique)", async () => {
    const insert = async (sql: string, params: unknown[]): Promise<string | undefined> => {
      const result = await pool.query<{ id: string }>(`${sql} RETURNING id`, params);
      return result.rows[0]?.id;
    };

    const alice = await insert(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      ["alice@migration.test", "argon2id$placeholder", "Alice"],
    );
    const bob = await insert(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
      ["bob@migration.test", "argon2id$placeholder", "Bob"],
    );
    const workspace = await insert(
      "INSERT INTO workspaces (name, slug, created_by) VALUES ($1, $2, $3)",
      ["DM Co", "dm-co", alice],
    );
    const directKey = [workspace, alice, bob].sort().join(":");

    await insert(
      "INSERT INTO conversations (workspace_id, kind, direct_key) VALUES ($1, 'direct', $2)",
      [workspace, directKey],
    );

    let violation: unknown;
    try {
      await pool.query(
        "INSERT INTO conversations (workspace_id, kind, direct_key) VALUES ($1, 'direct', $2)",
        [workspace, directKey],
      );
    } catch (error) {
      violation = error;
    }
    expect(violation).toBeTruthy();
    expect((violation as { code?: string }).code).toBe("23505");
  });

  it("enforces schema integrity constraints", async () => {
    // Event end must be after start.
    await expect(
      pool.query(
        "INSERT INTO calendar_events (workspace_id, title, type, start_at, end_at) SELECT id, 'Broken', 'meeting', now(), now() - interval '1 hour' FROM workspaces LIMIT 1",
      ),
    ).rejects.toThrow();

    // start_of_week accepts only 0 or 1.
    await expect(
      pool.query(
        "INSERT INTO user_preferences (user_id, start_of_week) SELECT id, 2 FROM users LIMIT 1",
      ),
    ).rejects.toThrow();

    // Users emails are stored lowercase.
    await expect(
      pool.query(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)",
        ["UPPER@migration.test", "argon2id$placeholder", "Upper"],
      ),
    ).rejects.toThrow();
  });
});
