import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env";
import { seedDemoData } from "../seeds/demo";
import { verifyPassword } from "../src/lib/passwords";

/**
 * Demo seed suite. Runs against TEST_DATABASE_URL; the seed itself is
 * transactional and supports --fresh, so it manages its own state.
 * Skipped entirely when TEST_DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const seedEnv = parseEnv({
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
  DEMO_PASSWORD: "nexus-demo-2026",
});

suite("demo seed", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("refuses to run against production", async () => {
    const productionEnv = parseEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/never",
    });
    await expect(seedDemoData({ env: productionEnv })).rejects.toThrow(/production/i);
  });

  it("seeds the complete demo dataset", async () => {
    const result = await seedDemoData({ env: seedEnv, fresh: true });

    expect(result).toEqual({
      users: 8,
      workspaces: 3,
      workspaceMembers: 14,
      projects: 9,
      projectMembers: 31,
      labels: 30,
      tasks: 46,
      subtasks: 6,
      comments: 5,
      attachments: 3,
      events: 10,
      eventAttendees: 41,
      conversations: 5,
      conversationMembers: 16,
      messages: 7,
      notifications: 12,
      activities: 18,
      preferences: 8,
    });
  });

  it("creates demo users whose password hash verifies against DEMO_PASSWORD", async () => {
    await seedDemoData({ env: seedEnv, fresh: true });

    const maya = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      ["maya@nexus.studio"],
    );
    const hash = maya.rows[0]?.password_hash;
    expect(hash).toBeTruthy();
    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash!, "nexus-demo-2026")).resolves.toBe(true);
    await expect(verifyPassword(hash!, "wrong-password")).resolves.toBe(false);
  });

  it("scopes labels per workspace with the fixed frontend hues", async () => {
    await seedDemoData({ env: seedEnv, fresh: true });

    const hues = await pool.query<{ name: string; hue: number }>(
      `SELECT l.name, l.hue FROM labels l
       JOIN workspaces w ON w.id = l.workspace_id
       WHERE w.slug = 'nexus-studio' ORDER BY l.name`,
    );
    const byName = new Map(hues.rows.map((row) => [row.name, row.hue]));
    expect(byName.get("design")).toBe(280);
    expect(byName.get("bug")).toBe(25);
    expect(byName.size).toBe(10);
  });

  it("produces live dashboard data: overdue, due-today and unread conversations", async () => {
    await seedDemoData({ env: seedEnv, fresh: true });

    const overdue = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM tasks WHERE due_date < now() AND status <> 'done' AND completed_at IS NULL",
    );
    expect(Number(overdue.rows[0]?.count)).toBeGreaterThanOrEqual(1);

    const dueToday = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM tasks WHERE due_date >= date_trunc('day', now()) AND due_date < date_trunc('day', now()) + interval '1 day' AND status <> 'done'",
    );
    expect(Number(dueToday.rows[0]?.count)).toBeGreaterThanOrEqual(1);

    // Maya has unread conversations (message newer than her last_read_at,
    // authored by someone else) — matches the frontend unread semantics.
    const unread = await pool.query<{ count: string }>(
      `SELECT count(DISTINCT c.id)::text AS count
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       JOIN users u ON u.email = 'maya@nexus.studio'
       JOIN messages m ON m.conversation_id = c.id
         AND m.created_at > cm.last_read_at AND m.author_id <> u.id
       WHERE cm.user_id = u.id`,
    );
    expect(Number(unread.rows[0]?.count)).toBeGreaterThanOrEqual(1);

    // Per-recipient isolation: Priya must not see Maya's notifications.
    const priya = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", ["priya@nexus.studio"]);
    const priyaNotifications = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM notifications WHERE user_id = $1",
      [priya.rows[0]?.id],
    );
    expect(Number(priyaNotifications.rows[0]?.count)).toBe(1);
  });

  it("is repeatable with --fresh and refuses to double-seed without it", async () => {
    await seedDemoData({ env: seedEnv, fresh: true });
    const again = await seedDemoData({ env: seedEnv, fresh: true });
    expect(again.tasks).toBe(46);

    const users = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
    expect(users.rows[0]?.count).toBe("8");

    await expect(seedDemoData({ env: seedEnv })).rejects.toThrow(/already contains users/i);
  });
});
