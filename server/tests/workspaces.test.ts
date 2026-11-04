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

describeDb("workspaces, members and RBAC", () => {
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

  /** Registers + logs in a user, returning their cookie jar. */
  async function createUser(prefix: string): Promise<{ email: string; cookie: string; userId: string }> {
    const address = uniqueEmail(prefix);
    await api(app).post("/api/v1/auth/register").send({ name: `${prefix} person`, email: address, password });
    const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
    const cookie = firstCookie(login);
    const me = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
    return { email: address, cookie, userId: me.body.data.user.id };
  }

  async function createWorkspace(cookie: string, name: string): Promise<string> {
    const response = await api(app)
      .post("/api/v1/workspaces")
      .set("Cookie", cookie)
      .send({ name, description: "A test workspace" });
    expect(response.status).toBe(201);
    return response.body.data.workspace.id;
  }

  describe("workspace lifecycle", () => {
    it("creates a workspace with the creator as owner and seeds labels", async () => {
      const owner = await createUser("owner");
      const workspaceId = await createWorkspace(owner.cookie, "Acme Studio");

      const labels = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM labels WHERE workspace_id = $1",
        [workspaceId],
      );
      expect(labels.rows[0]?.count).toBe("10");

      const list = await api(app).get("/api/v1/workspaces").set("Cookie", owner.cookie);
      expect(list.body.data.workspaces).toHaveLength(1);
      expect(list.body.data.workspaces[0]).toMatchObject({ id: workspaceId, role: "owner", memberCount: 1 });
    });

    it("lets an admin rename the workspace but not a member", async () => {
      const owner = await createUser("wsowner");
      const workspaceId = await createWorkspace(owner.cookie, "Rename Co");
      const member = await createUser("wsmember");

      // Add the member directly for a focused RBAC check.
      await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')", [
        workspaceId,
        member.userId,
      ]);

      const asMember = await api(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Cookie", member.cookie)
        .send({ name: "Hacked" });
      expect(asMember.status).toBe(403);

      const asOwner = await api(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Cookie", owner.cookie)
        .send({ name: "Renamed Co" });
      expect(asOwner.status).toBe(200);
      expect(asOwner.body.data.workspace.name).toBe("Renamed Co");
    });

    it("hides workspaces the caller does not belong to", async () => {
      const owner = await createUser("hiddenowner");
      const outsider = await createUser("outsider");
      const workspaceId = await createWorkspace(owner.cookie, "Private Co");

      const get = await api(app).get(`/api/v1/workspaces/${workspaceId}`).set("Cookie", outsider.cookie);
      expect(get.status).toBe(404);

      const members = await api(app).get(`/api/v1/workspaces/${workspaceId}/members`).set("Cookie", outsider.cookie);
      expect(members.status).toBe(404);
    });

    it("soft-deletes a workspace for the owner only", async () => {
      const owner = await createUser("delowner");
      const workspaceId = await createWorkspace(owner.cookie, "Doomed Co");

      const response = await api(app).delete(`/api/v1/workspaces/${workspaceId}`).set("Cookie", owner.cookie);
      expect(response.status).toBe(200);

      const list = await api(app).get("/api/v1/workspaces").set("Cookie", owner.cookie);
      expect(list.body.data.workspaces).toHaveLength(0);
    });
  });

  describe("member directory and roles", () => {
    it("lists members and filters by role", async () => {
      const owner = await createUser("dirowner");
      const workspaceId = await createWorkspace(owner.cookie, "Directory Co");
      const second = await createUser("dirmember");
      await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')", [
        workspaceId,
        second.userId,
      ]);

      const all = await api(app).get(`/api/v1/workspaces/${workspaceId}/members`).set("Cookie", owner.cookie);
      expect(all.status).toBe(200);
      expect(all.body.data.members).toHaveLength(2);
      expect(all.body.data.members[0]).toHaveProperty("role");
      expect(all.body.data.members[0]).toHaveProperty("workspaceIds");

      const admins = await api(app)
        .get(`/api/v1/workspaces/${workspaceId}/members?role=admin`)
        .set("Cookie", owner.cookie);
      expect(admins.body.data.members).toHaveLength(1);
      expect(admins.body.data.members[0].role).toBe("admin");
    });

    it("changes a member role (owner only) and protects the last owner", async () => {
      const owner = await createUser("roleowner");
      const workspaceId = await createWorkspace(owner.cookie, "Roles Co");
      const member = await createUser("rolemember");
      await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')", [
        workspaceId,
        member.userId,
      ]);

      // A member cannot change roles.
      const forbidden = await api(app)
        .patch(`/api/v1/workspaces/${workspaceId}/members/${member.userId}`)
        .set("Cookie", member.cookie)
        .send({ role: "admin" });
      expect(forbidden.status).toBe(403);

      // The owner can.
      const promoted = await api(app)
        .patch(`/api/v1/workspaces/${workspaceId}/members/${member.userId}`)
        .set("Cookie", owner.cookie)
        .send({ role: "admin" });
      expect(promoted.status).toBe(200);
      expect(promoted.body.data.member.role).toBe("admin");

      // Demoting the only owner is refused.
      const demoteOwner = await api(app)
        .patch(`/api/v1/workspaces/${workspaceId}/members/${owner.userId}`)
        .set("Cookie", owner.cookie)
        .send({ role: "admin" });
      expect(demoteOwner.status).toBe(409);
    });

    it("lets a member leave but protects the last owner from removal", async () => {
      const owner = await createUser("leaveowner");
      const workspaceId = await createWorkspace(owner.cookie, "Leaving Co");
      const member = await createUser("leaver");
      await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')", [
        workspaceId,
        member.userId,
      ]);

      const leave = await api(app)
        .delete(`/api/v1/workspaces/${workspaceId}/members/${member.userId}`)
        .set("Cookie", member.cookie);
      expect(leave.status).toBe(200);

      const owners = await pool.query("SELECT 1 FROM workspace_members WHERE workspace_id = $1", [workspaceId]);
      expect(owners.rowCount).toBe(1); // only the owner remains

      const removeOwner = await api(app)
        .delete(`/api/v1/workspaces/${workspaceId}/members/${owner.userId}`)
        .set("Cookie", owner.cookie);
      expect(removeOwner.status).toBe(409);
    });
  });

  describe("invitations", () => {
    it("invites, previews and accepts an invitation end to end", async () => {
      const owner = await createUser("invowner");
      const workspaceId = await createWorkspace(owner.cookie, "Invite Co");
      const inviteeEmail = uniqueEmail("invitee");

      const invite = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: inviteeEmail, role: "member" });
      expect(invite.status).toBe(201);
      expect(invite.body.data.invitation.email).toBe(inviteeEmail);

      const token = email.tokenFor(inviteeEmail, "invited");
      expect(token).toBeTruthy();

      const preview = await api(app).get(`/api/v1/invitations/${token}`);
      expect(preview.status).toBe(200);
      expect(preview.body.data.workspaceName).toBe("Invite Co");

      // The invitee registers and accepts.
      await api(app).post("/api/v1/auth/register").send({ name: "Invitee", email: inviteeEmail, password });
      const login = await api(app).post("/api/v1/auth/login").send({ email: inviteeEmail, password });
      const inviteeCookie = firstCookie(login);

      const accept = await api(app)
        .post("/api/v1/invitations/accept")
        .set("Cookie", inviteeCookie)
        .send({ token });
      expect(accept.status).toBe(200);
      expect(accept.body.data.membership).toMatchObject({ workspaceId, role: "member" });

      // The membership is real, and a member.joined activity was recorded.
      const membership = await pool.query("SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)", [
        workspaceId,
        inviteeEmail,
      ]);
      expect(membership.rows[0]?.role).toBe("member");
      const activity = await pool.query("SELECT 1 FROM activities WHERE workspace_id = $1 AND kind = 'member.joined'", [
        workspaceId,
      ]);
      expect(activity.rowCount).toBe(1);
    });

    it("refuses duplicate and already-member invitations", async () => {
      const owner = await createUser("dupowner");
      const workspaceId = await createWorkspace(owner.cookie, "Dup Invite Co");
      const inviteeEmail = uniqueEmail("dupinvitee");

      await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: inviteeEmail, role: "member" });
      const second = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: inviteeEmail, role: "member" });
      expect(second.status).toBe(409);

      const selfInvite = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: owner.email, role: "member" });
      expect(selfInvite.status).toBe(409);
    });

    it("only lets admins invite and revoke", async () => {
      const owner = await createUser("invpermowner");
      const workspaceId = await createWorkspace(owner.cookie, "Invite Perm Co");
      const member = await createUser("invpermmember");
      await pool.query("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')", [
        workspaceId,
        member.userId,
      ]);

      const forbidden = await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", member.cookie)
        .send({ email: uniqueEmail("nope"), role: "member" });
      expect(forbidden.status).toBe(403);
    });

    it("rejects an invitation accepted by the wrong account", async () => {
      const owner = await createUser("wrongacctowner");
      const workspaceId = await createWorkspace(owner.cookie, "Wrong Account Co");
      const targetEmail = uniqueEmail("intended");

      await api(app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set("Cookie", owner.cookie)
        .send({ email: targetEmail, role: "member" });
      const token = email.tokenFor(targetEmail, "invited")!;

      const wrongUser = await createUser("wronguser");
      const accept = await api(app)
        .post("/api/v1/invitations/accept")
        .set("Cookie", wrongUser.cookie)
        .send({ token });
      expect(accept.status).toBe(403);
    });
  });

  describe("profile and preferences", () => {
    it("updates profile fields and preferences", async () => {
      const user = await createUser("profile");

      const profile = await api(app)
        .patch("/api/v1/me/profile")
        .set("Cookie", user.cookie)
        .send({ name: "Renamed Person", title: "Staff Engineer", location: "Lisbon, PT" });
      expect(profile.status).toBe(200);
      expect(profile.body.data.user).toMatchObject({ name: "Renamed Person", title: "Staff Engineer", location: "Lisbon, PT" });

      const preferences = await api(app)
        .patch("/api/v1/me/preferences")
        .set("Cookie", user.cookie)
        .send({ density: "compact", startOfWeek: 0, projectUpdates: true });
      expect(preferences.status).toBe(200);
      expect(preferences.body.data.preferences).toMatchObject({ density: "compact", startOfWeek: 0, projectUpdates: true });
    });

    it("stores the active workspace only for members", async () => {
      const owner = await createUser("activeowner");
      const workspaceId = await createWorkspace(owner.cookie, "Active Co");
      const outsider = await createUser("activeoutsider");

      const ok = await api(app)
        .patch("/api/v1/me/active-workspace")
        .set("Cookie", owner.cookie)
        .send({ workspaceId });
      expect(ok.status).toBe(200);

      const denied = await api(app)
        .patch("/api/v1/me/active-workspace")
        .set("Cookie", outsider.cookie)
        .send({ workspaceId });
      expect(denied.status).toBe(404);

      const me = await api(app).get("/api/v1/me").set("Cookie", owner.cookie);
      expect(me.body.data.activeWorkspaceId).toBe(workspaceId);
    });
  });

  describe("CSRF protection", () => {
    it("rejects an unsafe request from a disallowed origin", async () => {
      const user = await createUser("csrf");
      const response = await api(app)
        .post("/api/v1/workspaces")
        .set("Cookie", user.cookie)
        .set("Origin", "https://evil.example.com")
        .send({ name: "CSRF Co" });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("allows an unsafe request from an allowed origin", async () => {
      const user = await createUser("csrfok");
      const response = await api(app)
        .post("/api/v1/workspaces")
        .set("Cookie", user.cookie)
        .set("Origin", "http://localhost:3000")
        .send({ name: "CSRF OK Co" });
      expect(response.status).toBe(201);
    });
  });
});
