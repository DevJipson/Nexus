import type { Express } from "express";
import { type Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  api,
  createCapturingTransport,
  createPool,
  createTestApp,
  describeDb,
  firstCookie,
  resetDatabase,
  testEnv,
  uniqueEmail,
  type CapturingTransport,
} from "./helpers/db";

describeDb("projects and tasks", () => {
  let pool: Pool;
  let app: Express;
  let email: CapturingTransport;

  const env = testEnv();
  const password = "Correct-Horse-9";

  beforeAll(async () => {
    pool = createPool();
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    email = createCapturingTransport();
    app = createTestApp(pool, env, email);
    await pool.query("TRUNCATE TABLE users CASCADE");
  });

  interface Actor {
    id: string;
    cookie: string;
    email: string;
  }

  async function createUser(prefix: string): Promise<Actor> {
    const address = uniqueEmail(prefix);
    await api(app).post("/api/v1/auth/register").send({ name: `${prefix} person`, email: address, password });
    const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
    const cookie = firstCookie(login);
    const me = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
    return { id: me.body.data.user.id, cookie, email: address };
  }

  async function createWorkspace(actor: Actor, name = "Work Co"): Promise<string> {
    const response = await api(app)
      .post("/api/v1/workspaces")
      .set("Cookie", actor.cookie)
      .send({ name });
    return response.body.data.workspace.id;
  }

  /** Adds a user to a workspace directly (role change via DB for brevity). */
  async function addMember(workspaceId: string, userId: string, role = "member"): Promise<void> {
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)", [
      workspaceId,
      userId,
      role,
    ]);
  }

  async function createProject(actor: Actor, workspaceId: string, overrides: Record<string, unknown> = {}): Promise<string> {
    const response = await api(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Cookie", actor.cookie)
      .send({
        name: "Atlas",
        description: "Design system",
        status: "active",
        priority: "high",
        dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        memberIds: [actor.id],
        ...overrides,
      });
    expect(response.status).toBe(201);
    return response.body.data.project.id;
  }

  async function createTask(actor: Actor, workspaceId: string, projectId: string, overrides: Record<string, unknown> = {}) {
    const response = await api(app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set("Cookie", actor.cookie)
      .send({
        projectId,
        title: "Ship the thing",
        status: "todo",
        priority: "medium",
        labels: [],
        ...overrides,
      });
    return response;
  }

  describe("projects", () => {
    it("creates a project with a derived unique key and logs activity", async () => {
      const owner = await createUser("prowner");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId, { name: "Atlas design" });

      const get = await api(app).get(`/api/v1/projects/${projectId}`).set("Cookie", owner.cookie);
      expect(get.status).toBe(200);
      expect(get.body.data.project.key).toBe("ATL");
      expect(get.body.data.project.memberIds).toContain(owner.id);
      expect(get.body.data.stats).toMatchObject({ total: 0, done: 0, open: 0 });

      const activity = await api(app).get(`/api/v1/workspaces/${workspaceId}/activity`).set("Cookie", owner.cookie);
      expect(activity.body.data.activity.some((a: { kind: string }) => a.kind === "project.created")).toBe(true);
    });

    it("derives unique keys on collision (ATL, ATL2)", async () => {
      const owner = await createUser("collision");
      const workspaceId = await createWorkspace(owner);
      const first = await createProject(owner, workspaceId, { name: "Atlas one" });
      const second = await createProject(owner, workspaceId, { name: "Atlas two" });

      const a = await api(app).get(`/api/v1/projects/${first}`).set("Cookie", owner.cookie);
      const b = await api(app).get(`/api/v1/projects/${second}`).set("Cookie", owner.cookie);
      expect(a.body.data.project.key).toBe("ATL");
      expect(b.body.data.project.key).toBe("ATL2");
    });

    it("rejects a project whose members are outside the workspace", async () => {
      const owner = await createUser("prowner2");
      const outsider = await createUser("proutsider");
      const workspaceId = await createWorkspace(owner);
      const response = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Cookie", owner.cookie)
        .send({
          name: "Bad members",
          dueDate: new Date(Date.now() + 86_400_000).toISOString(),
          memberIds: [outsider.id],
        });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("filters and sorts the portfolio list with stats", async () => {
      const owner = await createUser("plist");
      const workspaceId = await createWorkspace(owner);
      const active = await createProject(owner, workspaceId, { name: "Active One", status: "active" });
      await createProject(owner, workspaceId, { name: "Planned Two", status: "planning" });
      await createTask(owner, workspaceId, active, { status: "done" });
      await createTask(owner, workspaceId, active, { status: "todo" });

      const all = await api(app).get(`/api/v1/workspaces/${workspaceId}/projects`).set("Cookie", owner.cookie);
      expect(all.body.data.projects).toHaveLength(2);
      const activeRow = all.body.data.projects.find((p: { name: string }) => p.name === "Active One");
      expect(activeRow.stats).toMatchObject({ total: 2, done: 1, open: 1, completionRate: 50 });

      const filtered = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?status=active`)
        .set("Cookie", owner.cookie);
      expect(filtered.body.data.projects).toHaveLength(1);

      const sorted = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects?sort=name`)
        .set("Cookie", owner.cookie);
      expect(sorted.body.data.projects[0].name).toBe("Active One");
    });

    it("requires admin to create and lets a member read", async () => {
      const owner = await createUser("padmin");
      const member = await createUser("pmember");
      const workspaceId = await createWorkspace(owner);
      await addMember(workspaceId, member.id, "member");

      const asMember = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Cookie", member.cookie)
        .send({ name: "Nope", dueDate: new Date(Date.now() + 86_400_000).toISOString(), memberIds: [member.id] });
      expect(asMember.status).toBe(403);

      const projectId = await createProject(owner, workspaceId);
      const read = await api(app).get(`/api/v1/projects/${projectId}`).set("Cookie", member.cookie);
      expect(read.status).toBe(200);
    });

    it("hides projects from non-members (404)", async () => {
      const owner = await createUser("powner3");
      const outsider = await createUser("poutsider3");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);

      const response = await api(app).get(`/api/v1/projects/${projectId}`).set("Cookie", outsider.cookie);
      expect(response.status).toBe(404);
    });

    it("updates status/priority/dueDate and logs project.completed", async () => {
      const owner = await createUser("pupd");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId, { status: "active" });

      const response = await api(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set("Cookie", owner.cookie)
        .send({ status: "completed", priority: "low" });
      expect(response.status).toBe(200);
      expect(response.body.data.project).toMatchObject({ status: "completed", priority: "low" });

      const activity = await api(app).get(`/api/v1/workspaces/${workspaceId}/activity`).set("Cookie", owner.cookie);
      expect(activity.body.data.activity.some((a: { kind: string }) => a.kind === "project.completed")).toBe(true);
    });

    it("cascade-deletes tasks and detaches events/conversations on delete", async () => {
      const owner = await createUser("pdel");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);

      const task = await createTask(owner, workspaceId, projectId);
      const taskId = task.body.data.task.id;

      const event = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/events`)
        .set("Cookie", owner.cookie)
        .send({
          title: "Kickoff",
          type: "meeting",
          projectId,
          start: new Date(Date.now() + 3_600_000).toISOString(),
          end: new Date(Date.now() + 7_200_000).toISOString(),
          attendeeIds: [owner.id],
        });
      const eventId = event.body.data.event.id;

      const del = await api(app).delete(`/api/v1/projects/${projectId}`).set("Cookie", owner.cookie);
      expect(del.status).toBe(200);

      // Task is gone.
      expect((await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", owner.cookie)).status).toBe(404);

      // Event survives with a detached project.
      const eventAfter = await pool.query<{ project_id: string | null }>(
        "SELECT project_id FROM calendar_events WHERE id = $1",
        [eventId],
      );
      expect(eventAfter.rows[0]?.project_id).toBeNull();
    });
  });

  describe("tasks", () => {
    it("creates a task with sequential column order and logs task.created", async () => {
      const owner = await createUser("tcreate");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);

      const first = await createTask(owner, workspaceId, projectId, { title: "First" });
      const second = await createTask(owner, workspaceId, projectId, { title: "Second" });
      expect(first.status).toBe(201);
      expect(first.body.data.task.order).toBe(1);
      expect(second.body.data.task.order).toBe(2);

      const activity = await api(app).get(`/api/v1/workspaces/${workspaceId}/activity`).set("Cookie", owner.cookie);
      expect(activity.body.data.activity.filter((a: { kind: string }) => a.kind === "task.created")).toHaveLength(2);
    });

    it("notifies the assignee when a task is assigned to someone else", async () => {
      const owner = await createUser("tassignowner");
      const assignee = await createUser("tassignee");
      const workspaceId = await createWorkspace(owner);
      await addMember(workspaceId, assignee.id);
      const projectId = await createProject(owner, workspaceId, { memberIds: [owner.id, assignee.id] });

      const response = await createTask(owner, workspaceId, projectId, { assigneeId: assignee.id });
      expect(response.status).toBe(201);

      const notifications = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/notifications`)
        .set("Cookie", assignee.cookie);
      expect(notifications.body.data.notifications.some((n: { category: string }) => n.category === "task")).toBe(true);
      expect(notifications.body.data.unreadCount).toBeGreaterThanOrEqual(1);

      const activity = await api(app).get(`/api/v1/workspaces/${workspaceId}/activity`).set("Cookie", owner.cookie);
      expect(activity.body.data.activity.some((a: { kind: string }) => a.kind === "task.assigned")).toBe(true);
    });

    it("stamps and clears completedAt across status transitions", async () => {
      const owner = await createUser("tsatus");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      const taskId = (await createTask(owner, workspaceId, projectId)).body.data.task.id;

      const done = await api(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set("Cookie", owner.cookie)
        .send({ status: "done" });
      expect(done.body.data.task.completedAt).not.toBeNull();

      const reopened = await api(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set("Cookie", owner.cookie)
        .send({ status: "todo" });
      expect(reopened.body.data.task.completedAt).toBeNull();
    });

    it("renumbers a column when a task is moved (position endpoint)", async () => {
      const owner = await createUser("tmove");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);

      const a = (await createTask(owner, workspaceId, projectId, { title: "Alpha" })).body.data.task.id;
      const b = (await createTask(owner, workspaceId, projectId, { title: "Bravo" })).body.data.task.id;
      const c = (await createTask(owner, workspaceId, projectId, { title: "Charlie" })).body.data.task.id;

      // Move C to the front of the in_progress column and move A across.
      const moveA = await api(app)
        .patch(`/api/v1/tasks/${a}/position`)
        .set("Cookie", owner.cookie)
        .send({ status: "in_progress", index: 0 });
      expect(moveA.status).toBe(200);
      expect(moveA.body.data.column.map((t: { id: string }) => t.id)).toEqual([a]);

      const moveC = await api(app)
        .patch(`/api/v1/tasks/${c}/position`)
        .set("Cookie", owner.cookie)
        .send({ status: "todo", index: 0 });
      expect(moveC.status).toBe(200);
      // Column order should now be C, B with renumbered 1..n.
      const column = moveC.body.data.column as Array<{ id: string; order: number }>;
      expect(column.map((t) => t.id)).toEqual([c, b]);
      expect(column.map((t) => t.order)).toEqual([1, 2]);
    });

    it("filters tasks by assignee, priority, project and search", async () => {
      const owner = await createUser("tfilter");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      await createTask(owner, workspaceId, projectId, { title: "Urgent thing", priority: "urgent", assigneeId: owner.id });
      await createTask(owner, workspaceId, projectId, { title: "Low thing", priority: "low" });

      const byPriority = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/tasks?priority=urgent`)
        .set("Cookie", owner.cookie);
      expect(byPriority.body.data.tasks).toHaveLength(1);

      const unassigned = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/tasks?assignee=unassigned`)
        .set("Cookie", owner.cookie);
      expect(unassigned.body.data.tasks).toHaveLength(1);

      const search = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/tasks?search=urgent`)
        .set("Cookie", owner.cookie);
      expect(search.body.data.tasks).toHaveLength(1);
    });

    it("validates label membership against the workspace catalog", async () => {
      const owner = await createUser("tlabel");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);

      const ok = await createTask(owner, workspaceId, projectId, { labels: ["design", "frontend"] });
      expect(ok.status).toBe(201);
      expect(ok.body.data.task.labels.sort()).toEqual(["design", "frontend"]);

      const bad = await createTask(owner, workspaceId, projectId, { labels: ["not-a-label"] });
      expect(bad.status).toBe(400);
    });

    it("manages subtasks, comments and attachment metadata", async () => {
      const owner = await createUser("tchildren");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      const taskId = (await createTask(owner, workspaceId, projectId)).body.data.task.id;

      const subtask = await api(app)
        .post(`/api/v1/tasks/${taskId}/subtasks`)
        .set("Cookie", owner.cookie)
        .send({ title: "Step one" });
      expect(subtask.status).toBe(201);

      const toggled = await api(app)
        .patch(`/api/v1/tasks/${taskId}/subtasks/${subtask.body.data.subtask.id}`)
        .set("Cookie", owner.cookie)
        .send({ done: true });
      expect(toggled.body.data.subtask.done).toBe(true);

      const comment = await api(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Cookie", owner.cookie)
        .send({ body: "Looks good." });
      expect(comment.status).toBe(201);
      expect(comment.body.data.comment.authorId).toBe(owner.id);

      const attachment = await api(app)
        .post(`/api/v1/tasks/${taskId}/attachments`)
        .set("Cookie", owner.cookie)
        .send({ name: "brief.pdf", size: 428_000, mimeType: "application/pdf" });
      expect(attachment.status).toBe(201);
      expect(attachment.body.data.attachment.size).toBe(428_000);

      const detail = await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", owner.cookie);
      expect(detail.body.data.task.subtasks).toHaveLength(1);
      expect(detail.body.data.task.comments).toHaveLength(1);
      expect(detail.body.data.task.attachments).toHaveLength(1);
    });

    it("rejects cross-workspace task access (404)", async () => {
      const owner = await createUser("tcrossowner");
      const outsider = await createUser("tcrossoutsider");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      const taskId = (await createTask(owner, workspaceId, projectId)).body.data.task.id;

      const response = await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", outsider.cookie);
      expect(response.status).toBe(404);
    });

    it("deletes a task and its children", async () => {
      const owner = await createUser("tdel");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      const taskId = (await createTask(owner, workspaceId, projectId)).body.data.task.id;
      await api(app).post(`/api/v1/tasks/${taskId}/subtasks`).set("Cookie", owner.cookie).send({ title: "child" });

      const del = await api(app).delete(`/api/v1/tasks/${taskId}`).set("Cookie", owner.cookie);
      expect(del.status).toBe(200);

      const subtasks = await pool.query("SELECT 1 FROM subtasks WHERE task_id = $1", [taskId]);
      expect(subtasks.rowCount).toBe(0);
    });
  });

  describe("calendar events", () => {
    it("creates, lists by range and deletes events", async () => {
      const owner = await createUser("evowner");
      const workspaceId = await createWorkspace(owner);
      const start = new Date(Date.now() + 86_400_000);
      const end = new Date(start.getTime() + 3_600_000);

      const created = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/events`)
        .set("Cookie", owner.cookie)
        .send({
          title: "Weekly sync",
          type: "meeting",
          start: start.toISOString(),
          end: end.toISOString(),
          attendeeIds: [owner.id],
        });
      expect(created.status).toBe(201);

      const listed = await api(app).get(`/api/v1/workspaces/${workspaceId}/events`).set("Cookie", owner.cookie);
      expect(listed.body.data.events).toHaveLength(1);

      const del = await api(app).delete(`/api/v1/events/${created.body.data.event.id}`).set("Cookie", owner.cookie);
      expect(del.status).toBe(200);
      const after = await api(app).get(`/api/v1/workspaces/${workspaceId}/events`).set("Cookie", owner.cookie);
      expect(after.body.data.events).toHaveLength(0);
    });

    it("rejects an event whose end precedes its start", async () => {
      const owner = await createUser("evbad");
      const workspaceId = await createWorkspace(owner);
      const response = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/events`)
        .set("Cookie", owner.cookie)
        .send({
          title: "Broken",
          type: "meeting",
          start: new Date(Date.now() + 7_200_000).toISOString(),
          end: new Date(Date.now() + 3_600_000).toISOString(),
          attendeeIds: [owner.id],
        });
      expect(response.status).toBe(400);
    });
  });

  describe("notifications and activity", () => {
    it("marks a single notification read and all as read", async () => {
      const owner = await createUser("notifowner");
      const assignee = await createUser("notifassignee");
      const workspaceId = await createWorkspace(owner);
      await addMember(workspaceId, assignee.id);
      const projectId = await createProject(owner, workspaceId, { memberIds: [owner.id, assignee.id] });
      await createTask(owner, workspaceId, projectId, { assigneeId: assignee.id });

      const list = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/notifications`)
        .set("Cookie", assignee.cookie);
      const notificationId = list.body.data.notifications[0].id;

      const read = await api(app)
        .post(`/api/v1/notifications/${notificationId}/read`)
        .set("Cookie", assignee.cookie);
      expect(read.body.data.notification.read).toBe(true);

      await createTask(owner, workspaceId, projectId, { title: "Second", assigneeId: assignee.id });
      const allRead = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/notifications/read-all`)
        .set("Cookie", assignee.cookie);
      expect(allRead.status).toBe(200);

      const after = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/notifications`)
        .set("Cookie", assignee.cookie);
      expect(after.body.data.unreadCount).toBe(0);
    });

    it("returns workspace activity newest first", async () => {
      const owner = await createUser("actowner");
      const workspaceId = await createWorkspace(owner);
      const projectId = await createProject(owner, workspaceId);
      await createTask(owner, workspaceId, projectId);

      const response = await api(app).get(`/api/v1/workspaces/${workspaceId}/activity`).set("Cookie", owner.cookie);
      const entries = response.body.data.activity as Array<{ kind: string; createdAt: string }>;
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries[0]?.kind).toBe("task.created");
      const times = entries.map((e) => new Date(e.createdAt).getTime());
      expect([...times].sort((x, y) => y - x)).toEqual(times);
    });
  });
});
