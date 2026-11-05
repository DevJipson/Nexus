/**
 * Verification for Phase 4 (messaging + sockets) and the Phase 3 delete paths.
 * Covers the HTTP conversation API, direct-thread dedupe, unread counts,
 * socket authentication/authorization, post-commit message:new delivery, and
 * transaction rollback integrity. Database-backed: skips without TEST_DATABASE_URL.
 */
import { createServer } from "node:http";
import type { Express } from "express";
import { type Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
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
  logger,
  type CapturingTransport,
} from "./helpers/db";
import { createSocketServer } from "../src/sockets/index";
import { createSessionService } from "../src/modules/auth/session.service";
import { createWorkspaceService } from "../src/modules/workspaces/workspaces.service";
import { createConversationService } from "../src/modules/conversations/conversations.service";

describeDb("messaging and sockets", () => {
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
    const response = await api(app).post("/api/v1/workspaces").set("Cookie", actor.cookie).send({ name });
    return response.body.data.workspace.id;
  }

  async function addMember(workspaceId: string, userId: string, role = "member"): Promise<void> {
    await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)", [
      workspaceId,
      userId,
      role,
    ]);
  }

  async function createProject(actor: Actor, workspaceId: string): Promise<string> {
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
      });
    expect(response.status).toBe(201);
    return response.body.data.project.id;
  }

  async function createTask(actor: Actor, workspaceId: string, projectId: string, overrides: Record<string, unknown> = {}) {
    return api(app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set("Cookie", actor.cookie)
      .send({ projectId, title: "Ship it", status: "todo", priority: "medium", labels: [], ...overrides });
  }

  /** Attaches a real Socket.IO server to the test app; caller must close(). */
  async function startSocketServer(): Promise<{ url: string; close: () => Promise<void> }> {
    const sessions = createSessionService({ pool, logger });
    const workspaces = createWorkspaceService({ pool, logger });
    const conversations = createConversationService({ pool, workspaces });
    const httpServer = createServer(app);
    createSocketServer(httpServer, { env, logger, pool, sessions, workspaces, conversations });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("no address");
    const url = `http://127.0.0.1:${address.port}`;
    return {
      url,
      close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
    };
  }

  function connectSocket(url: string, cookie: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(url, {
        transports: ["websocket"],
        extraHeaders: { Cookie: cookie },
        reconnection: false,
      });
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err: Error) => reject(err));
    });
  }

  it("creates a direct conversation with exactly one other participant and dedupes by pair", async () => {
    const maya = await createUser("maya");
    const tomas = await createUser("tomas");
    const ws = await createWorkspace(maya);
    await addMember(ws, tomas.id);

    // participantIds are the OTHER participants only (frontend contract).
    const first = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", maya.cookie)
      .send({ kind: "direct", participantIds: [tomas.id] });
    expect(first.status).toBe(201);
    expect(first.body.data.conversation.participantIds.sort()).toEqual([maya.id, tomas.id].sort());

    // Creating the same pair again returns the same thread, never a duplicate.
    const second = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", tomas.cookie)
      .send({ kind: "direct", participantIds: [maya.id], firstMessage: "hello from tomas" });
    expect(second.status).toBe(201);
    expect(second.body.data.conversation.id).toBe(first.body.data.conversation.id);

    const count = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM conversations WHERE workspace_id = $1 AND kind = 'direct'",
      [ws],
    );
    expect(count.rows[0]?.count).toBe("1");

    // Single participantIds entry is NOT rejected anymore (regression test for the < 2 bug).
    const mem = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM conversation_members WHERE conversation_id = $1",
      [first.body.data.conversation.id],
    );
    expect(mem.rows[0]?.count).toBe("2");
  });

  it("rejects a direct conversation with zero other participants", async () => {
    const maya = await createUser("maya");
    const ws = await createWorkspace(maya);
    const response = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", maya.cookie)
      .send({ kind: "direct", participantIds: [] });
    expect(response.status).toBe(400);
  });

  it("sends messages, counts unread for recipients, and marks read", async () => {
    const maya = await createUser("maya");
    const tomas = await createUser("tomas");
    const ws = await createWorkspace(maya);
    await addMember(ws, tomas.id);

    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", maya.cookie)
      .send({ kind: "direct", participantIds: [tomas.id], firstMessage: "first!" });
    expect(created.status).toBe(201);
    const conversationId = created.body.data.conversation.id;

    const sent = await api(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", maya.cookie)
      .send({ body: "second!" });
    expect(sent.status).toBe(201);

    // Tomas sees the thread with 2 unread messages from maya (his last_read_at is in the past).
    const listForTomas = await api(app).get(`/api/v1/workspaces/${ws}/conversations`).set("Cookie", tomas.cookie);
    expect(listForTomas.status).toBe(200);
    const thread = listForTomas.body.data.conversations.find((c: { id: string }) => c.id === conversationId);
    expect(thread.unread).toBe(2);
    expect(thread.lastMessage.body).toBe("second!");

    const messages = await api(app).get(`/api/v1/conversations/${conversationId}/messages`).set("Cookie", tomas.cookie);
    expect(messages.status).toBe(200);
    expect(messages.body.data.messages.map((m: { body: string }) => m.body)).toEqual(["first!", "second!"]);

    await api(app).post(`/api/v1/conversations/${conversationId}/read`).set("Cookie", tomas.cookie);
    const afterRead = await api(app).get(`/api/v1/workspaces/${ws}/conversations`).set("Cookie", tomas.cookie);
    const readThread = afterRead.body.data.conversations.find((c: { id: string }) => c.id === conversationId);
    expect(readThread.unread).toBe(0);
  });

  it("hides a conversation from non-members (404, no existence leak)", async () => {
    const maya = await createUser("maya");
    const tomas = await createUser("tomas");
    const outsider = await createUser("outsider");
    const ws = await createWorkspace(maya);
    await addMember(ws, tomas.id);
    await addMember(ws, outsider.id); // member of workspace, NOT of the conversation

    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", maya.cookie)
      .send({ kind: "direct", participantIds: [tomas.id] });
    const conversationId = created.body.data.conversation.id;

    const read = await api(app).get(`/api/v1/conversations/${conversationId}/messages`).set("Cookie", outsider.cookie);
    expect(read.status).toBe(404);
    const send = await api(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", outsider.cookie)
      .send({ body: "sneak in" });
    expect(send.status).toBe(404);
  });

  it("deletes a task: children cascade, then GETs 404", async () => {
    const owner = await createUser("owner");
    const ws = await createWorkspace(owner);
    const projectId = await createProject(owner, ws);
    const created = await createTask(owner, ws, projectId);
    const taskId = created.body.data.task.id;

    const subtask = await api(app)
      .post(`/api/v1/tasks/${taskId}/subtasks`)
      .set("Cookie", owner.cookie)
      .send({ title: "sub" });
    expect(subtask.status).toBe(201);

    const comment = await api(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set("Cookie", owner.cookie)
      .send({ body: "note" });
    expect(comment.status).toBe(201);

    const deleted = await api(app).delete(`/api/v1/tasks/${taskId}`).set("Cookie", owner.cookie);
    expect([200, 204]).toContain(deleted.status);

    const gone = await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", owner.cookie);
    expect(gone.status).toBe(404);

    const subtasks = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM subtasks WHERE task_id = $1",
      [taskId],
    );
    expect(subtasks.rows[0]?.count).toBe("0");
    const comments = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM comments WHERE task_id = $1",
      [taskId],
    );
    expect(comments.rows[0]?.count).toBe("0");
  });

  it("creates subtasks with sequential sort_order and rejects invalid ones", async () => {
    const owner = await createUser("owner");
    const ws = await createWorkspace(owner);
    const projectId = await createProject(owner, ws);
    const created = await createTask(owner, ws, projectId);
    const taskId = created.body.data.task.id;

    for (const title of ["one", "two", "three"]) {
      const res = await api(app).post(`/api/v1/tasks/${taskId}/subtasks`).set("Cookie", owner.cookie).send({ title });
      expect(res.status).toBe(201);
    }
    const rows = await pool.query<{ sort_order: number }>(
      "SELECT sort_order FROM subtasks WHERE task_id = $1 ORDER BY sort_order ASC",
      [taskId],
    );
    expect(rows.rows.map((r) => r.sort_order)).toEqual([0, 1, 2]);

    const bad = await api(app).post(`/api/v1/tasks/${taskId}/subtasks`).set("Cookie", owner.cookie).send({ title: "" });
    expect(bad.status).toBe(400);
  });

  it("dedupes duplicate attendeeIds instead of failing with a 500", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const ws = await createWorkspace(owner);
    await addMember(ws, other.id);
    const now = Date.now();
    const response = await api(app)
      .post(`/api/v1/workspaces/${ws}/events`)
      .set("Cookie", owner.cookie)
      .send({
        title: "Planning",
        type: "meeting",
        start: new Date(now + 3_600_000).toISOString(),
        end: new Date(now + 7_200_000).toISOString(),
        attendeeIds: [owner.id, owner.id, other.id, other.id],
      });
    expect(response.status).toBe(201);
    const attendees = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM event_attendees ea JOIN calendar_events e ON e.id = ea.event_id WHERE e.workspace_id = $1",
      [ws],
    );
    expect(attendees.rows[0]?.count).toBe("2");
  });

  it("updates and deletes an event with emitted workspace scoping", async () => {
    const owner = await createUser("owner");
    const ws = await createWorkspace(owner);
    const now = Date.now();
    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/events`)
      .set("Cookie", owner.cookie)
      .send({
        title: "Standup",
        type: "meeting",
        start: new Date(now + 3_600_000).toISOString(),
        end: new Date(now + 7_200_000).toISOString(),
        attendeeIds: [owner.id],
      });
    expect(created.status).toBe(201);
    const eventId = created.body.data.event.id;

    const updated = await api(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("Cookie", owner.cookie)
      .send({ title: "Standup (moved)" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.event.title).toBe("Standup (moved)");

    const badUpdate = await api(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("Cookie", owner.cookie)
      .send({ end: new Date(now + 1_800_000).toISOString() });
    expect(badUpdate.status).toBe(400); // end before existing start -> service validation

    const deleted = await api(app).delete(`/api/v1/events/${eventId}`).set("Cookie", owner.cookie);
    expect([200, 204]).toContain(deleted.status);
    const list = await api(app).get(`/api/v1/workspaces/${ws}/events`).set("Cookie", owner.cookie);
    expect(list.body.data.events.map((e: { id: string }) => e.id)).not.toContain(eventId);
  });

  it("enforces socket auth and workspace/conversation subscribe authorization", async () => {
    const owner = await createUser("owner");
    const ws = await createWorkspace(owner);
    const other = await createUser("other");
    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", owner.cookie)
      .send({ kind: "direct", participantIds: [other.id] })
      .catch(() => undefined);
    // other is not a workspace member yet; expect validation failure
    expect(created?.status).toBe(400);

    await addMember(ws, other.id);
    const created2 = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", owner.cookie)
      .send({ kind: "direct", participantIds: [other.id] });
    expect(created2.status).toBe(201);
    const conversationId = created2.body.data.conversation.id;

    const sessions = createSessionService({ pool, logger });
    const workspaces = createWorkspaceService({ pool, logger });
    const conversations = createConversationService({ pool, workspaces });

    const httpServer = createServer(app);
    createSocketServer(httpServer, { env, logger, pool, sessions, workspaces, conversations });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("no address");
    const url = `http://127.0.0.1:${address.port}`;

    const connect = (cookie?: string): Promise<Socket> =>
      new Promise((resolve, reject) => {
        const socket = ioClient(url, {
          transports: ["websocket"],
          extraHeaders: cookie ? { Cookie: cookie } : {},
          reconnection: false,
        });
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", (err: Error) => reject(err));
      });

    // No credentials -> rejected
    await expect(connect()).rejects.toThrow("UNAUTHENTICATED");
    // Garbage cookie -> rejected
    await expect(connect("nexus_session=garbage")).rejects.toThrow();

    // Valid cookie -> connects
    const ownerSocket = await connect(owner.cookie);
    const otherWs = await createWorkspace(other);

    const subOtherWorkspace = await new Promise<[string | null, boolean]>((resolve) => {
      ownerSocket.emit("workspace:subscribe", { workspaceId: otherWs }, (err: string | null, ok: boolean) =>
        resolve([err, ok]),
      );
    });
    expect(subOtherWorkspace[1]).toBe(false);
    expect(subOtherWorkspace[0]).toBe("FORBIDDEN");

    const subOwnWorkspace = await new Promise<[string | null, boolean]>((resolve) => {
      ownerSocket.emit("workspace:subscribe", { workspaceId: ws }, (err: string | null, ok: boolean) =>
        resolve([err, ok]),
      );
    });
    expect(subOwnWorkspace).toEqual([null, true]);

    const subOwnConversation = await new Promise<[string | null, boolean]>((resolve) => {
      ownerSocket.emit("conversation:subscribe", { conversationId }, (err: string | null, ok: boolean) =>
        resolve([err, ok]),
      );
    });
    expect(subOwnConversation).toEqual([null, true]);

    // other user cannot join the direct conversation room? other IS a member -> allowed
    const otherSocket = await connect(other.cookie);
    const subAsOther = await new Promise<[string | null, boolean]>((resolve) => {
      otherSocket.emit("conversation:subscribe", { conversationId }, (err: string | null, ok: boolean) =>
        resolve([err, ok]),
      );
    });
    expect(subAsOther).toEqual([null, true]);

    // outsider cannot join the conversation room
    const outsider = await createUser("outsider");
    await addMember(ws, outsider.id); // workspace member but NOT conversation member
    const outsiderSocket = await connect(outsider.cookie);
    const subAsOutsider = await new Promise<[string | null, boolean]>((resolve) => {
      outsiderSocket.emit("conversation:subscribe", { conversationId }, (err: string | null, ok: boolean) =>
        resolve([err, ok]),
      );
    });
    expect(subAsOutsider[1]).toBe(false);
    expect(subAsOutsider[0]).toBe("FORBIDDEN");

    ownerSocket.disconnect();
    otherSocket.disconnect();
    outsiderSocket.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("delivers message:new to subscribed sockets only after commit", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const ws = await createWorkspace(owner);
    await addMember(ws, other.id);
    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", owner.cookie)
      .send({ kind: "direct", participantIds: [other.id] });
    const conversationId = created.body.data.conversation.id;

    const sessions = createSessionService({ pool, logger });
    const workspaces = createWorkspaceService({ pool, logger });
    const conversations = createConversationService({ pool, workspaces });
    const httpServer = createServer(app);
    createSocketServer(httpServer, { env, logger, pool, sessions, workspaces, conversations });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("no address");
    const url = `http://127.0.0.1:${address.port}`;

    const otherSocket = await new Promise<Socket>((resolve, reject) => {
      const socket = ioClient(url, {
        transports: ["websocket"],
        extraHeaders: { Cookie: other.cookie },
        reconnection: false,
      });
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err: Error) => reject(err));
    });

    await new Promise<void>((resolve, reject) => {
      otherSocket.emit("conversation:subscribe", { conversationId }, (err: string | null, ok: boolean) =>
        err || !ok ? reject(new Error(err ?? "subscribe failed")) : resolve(),
      );
    });

    const received = new Promise<{ message: { body: string }; recipientIds: string[] }>((resolve) => {
      otherSocket.on("message:new", resolve);
    });

    const sent = await api(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Cookie", owner.cookie)
      .send({ body: "commit-then-emit" });
    expect(sent.status).toBe(201);

    const payload = await Promise.race([
      received,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("message:new not received")), 5000)),
    ]);
    expect(payload.message.body).toBe("commit-then-emit");
    expect(payload.recipientIds.sort()).toEqual([owner.id, other.id].sort());

    otherSocket.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rolls the create transaction back cleanly when validation fails mid-flight", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const ws = await createWorkspace(owner);
    await addMember(ws, other.id);

    // Group with too-short name -> validation error inside the transaction.
    const bad = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", owner.cookie)
      .send({ kind: "group", name: "x", participantIds: [other.id] });
    expect(bad.status).toBe(400);

    const convs = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM conversations WHERE workspace_id = $1",
      [ws],
    );
    expect(convs.rows[0]?.count).toBe("0");
    const members = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM conversation_members cm
        JOIN conversations c ON c.id = cm.conversation_id
       WHERE c.workspace_id = $1`,
      [ws],
    );
    expect(members.rows[0]?.count).toBe("0");

    // Event with attendee outside the workspace -> rejected before any insert.
    const outsider = await createUser("outsider");
    const now = Date.now();
    const badEvent = await api(app)
      .post(`/api/v1/workspaces/${ws}/events`)
      .set("Cookie", owner.cookie)
      .send({
        title: "Nope",
        type: "meeting",
        start: new Date(now + 3_600_000).toISOString(),
        end: new Date(now + 7_200_000).toISOString(),
        attendeeIds: [owner.id, outsider.id],
      });
    expect(badEvent.status).toBe(400);
    const events = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM calendar_events WHERE workspace_id = $1",
      [ws],
    );
    expect(events.rows[0]?.count).toBe("0");
  });

  it("pushes conversation:new to participants' personal rooms on creation", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const ws = await createWorkspace(owner);
    await addMember(ws, other.id);

    const socket = await startSocketServer();
    const otherSocket = await connectSocket(socket.url, other.cookie);
    // Note: no workspace/conversation subscribe — delivery must come from the user room.
    const received = new Promise<{ conversation: { id: string; participantIds: string[] } }>((resolve) => {
      otherSocket.on("conversation:new", resolve);
    });

    const created = await api(app)
      .post(`/api/v1/workspaces/${ws}/conversations`)
      .set("Cookie", owner.cookie)
      .send({ kind: "direct", participantIds: [other.id] });
    expect(created.status).toBe(201);

    const payload = await Promise.race([
      received,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("conversation:new not received")), 5000)),
    ]);
    expect(payload.conversation.id).toBe(created.body.data.conversation.id);
    expect(payload.conversation.participantIds.sort()).toEqual([owner.id, other.id].sort());

    otherSocket.disconnect();
    await socket.close();
  });

  it("fans task:updated out to the workspace room after a subtask is added", async () => {
    const owner = await createUser("owner");
    const ws = await createWorkspace(owner);
    const projectId = await createProject(owner, ws);
    const created = await createTask(owner, ws, projectId);
    const taskId = created.body.data.task.id;

    const socket = await startSocketServer();
    const ownerSocket = await connectSocket(socket.url, owner.cookie);
    await new Promise<void>((resolve, reject) => {
      ownerSocket.emit("workspace:subscribe", { workspaceId: ws }, (err: string | null, ok: boolean) =>
        err || !ok ? reject(new Error(err ?? "subscribe failed")) : resolve(),
      );
    });

    const received = new Promise<{ task: { id: string; subtasks: unknown[] } }>((resolve) => {
      ownerSocket.on("task:updated", resolve);
    });

    const subtask = await api(app)
      .post(`/api/v1/tasks/${taskId}/subtasks`)
      .set("Cookie", owner.cookie)
      .send({ title: "ship it" });
    expect(subtask.status).toBe(201);

    const payload = await Promise.race([
      received,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("task:updated not received")), 5000)),
    ]);
    expect(payload.task.id).toBe(taskId);
    expect(payload.task.subtasks).toHaveLength(1);

    ownerSocket.disconnect();
    await socket.close();
  });
});
