/**
 * Live end-to-end smoke test against a running NEXUS API.
 * Usage: tsx scripts/smoke.ts http://localhost:4000
 */
const base = process.argv[2] ?? "http://localhost:4000";
const marker = { "X-Requested-With": "nexus", "Content-Type": "application/json" };

interface Jar { cookie: string | null }

async function call(method: string, path: string, body?: unknown, jar?: Jar): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { ...marker };
  if (jar?.cookie) headers.Cookie = jar.cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (jar) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) jar.cookie = setCookie.split(";")[0];
  }
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function assert(condition: boolean, label: string): void {
  console.log(`${condition ? "  ✓" : "  ✗"} ${label}`);
  if (!condition) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log(`Smoke testing ${base}\n`);

  const health = await call("GET", "/healthz");
  assert(health.status === 200, "GET /healthz → 200");
  const ready = await call("GET", "/readyz");
  assert(ready.status === 200, "GET /readyz → 200 (database up)");

  const anon = await call("GET", "/api/v1/me");
  assert(anon.status === 401, "GET /api/v1/me without session → 401");

  // Log in as a seeded demo user.
  const login = await call("POST", "/api/v1/auth/login", { email: "maya@nexus.studio", password: "nexus-demo-2026" });
  const jar: Jar = { cookie: null };
  const login2 = await call("POST", "/api/v1/auth/login", { email: "maya@nexus.studio", password: "nexus-demo-2026" }, jar);
  assert(login.status === 200 && login2.status === 200, "demo login (maya@nexus.studio) → 200");
  assert(Boolean(jar.cookie), "session cookie issued");

  const me = await call("GET", "/api/v1/me", undefined, jar);
  const meBody = me.body as { data: { user: { email: string }; workspaces: unknown[] } };
  assert(me.status === 200, "GET /api/v1/me → 200");
  assert(meBody.data.user.email === "maya@nexus.studio", "session resolves to the seeded user");
  assert(meBody.data.workspaces.length === 3, "demo user belongs to 3 workspaces");

  const workspaces = meBody.data.workspaces as Array<{ id: string; role: string; name: string }>;
  const studio = workspaces.find((w) => w.name === "Nexus Studio");
  assert(studio?.role === "owner", "role is resolved per workspace (Studio = owner)");

  const members = await call("GET", `/api/v1/workspaces/${studio?.id}/members`, undefined, jar);
  const memberBody = members.body as { data: { members: Array<{ role: string; presence: string }> } };
  assert(members.status === 200, "GET members → 200");
  assert(memberBody.data.members.length === 8, "Nexus Studio has 8 members");

  const renamed = await call("PATCH", `/api/v1/workspaces/${studio?.id}`, { name: "Nexus Studio" }, jar);
  assert(renamed.status === 200, "owner can rename workspace");

  const prefs = await call("PATCH", "/api/v1/me/preferences", { density: "compact" }, jar);
  assert(prefs.status === 200, "PATCH /me/preferences → 200");

  // Core work: create a project, a task, move it, comment, then delete.
  const meAfter = await call("GET", "/api/v1/me", undefined, jar);
  const mayaId = (meAfter.body as { data: { user: { id: string } } }).data.user.id;
  const created = await call(
    "POST",
    `/api/v1/workspaces/${studio?.id}/projects`,
    {
      name: `Smoke project ${Date.now()}`,
      description: "Created by the smoke test",
      status: "active",
      priority: "high",
      dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      memberIds: [mayaId],
    },
    jar,
  );
  const createdBody = created.body as { data?: { project?: { id: string; key: string } } };
  assert(created.status === 201, "POST project → 201");
  const projectId = createdBody.data?.project?.id as string;
  assert(typeof createdBody.data?.project?.key === "string", `project key derived (${createdBody.data?.project?.key})`);

  const task = await call(
    "POST",
    `/api/v1/workspaces/${studio?.id}/tasks`,
    { projectId, title: "Smoke task", status: "todo", priority: "urgent", labels: ["frontend"] },
    jar,
  );
  const taskBody = task.body as { data?: { task?: { id: string; order: number } } };
  assert(
    task.status === 201 && typeof taskBody.data?.task?.order === "number",
    `POST task → 201 (column order ${taskBody.data?.task?.order})`,
  );
  const taskId = taskBody.data?.task?.id as string;

  const moved = await call("PATCH", `/api/v1/tasks/${taskId}/position`, { status: "in_progress", index: 0 }, jar);
  const movedBody = moved.body as { data?: { column?: Array<{ id: string; order: number }> } };
  assert(
    moved.status === 200 && movedBody.data?.column?.[0]?.id === taskId,
    "PATCH task position → renumbered column",
  );

  const comment = await call("POST", `/api/v1/tasks/${taskId}/comments`, { body: "Smoke comment." }, jar);
  assert(comment.status === 201, "POST task comment → 201");

  const activity = await call("GET", `/api/v1/workspaces/${studio?.id}/activity?limit=5`, undefined, jar);
  const activityEntries = (activity.body as { data: { activity: Array<{ kind: string }> } }).data.activity;
  assert(activityEntries.some((entry) => entry.kind === "task.created"), "activity feed records task.created");

  const delProject = await call("DELETE", `/api/v1/projects/${projectId}`, undefined, jar);
  assert(delProject.status === 200, "DELETE project → 200 (cascade)");
  const taskGone = await call("GET", `/api/v1/tasks/${taskId}`, undefined, jar);
  assert(taskGone.status === 404, "cascaded task is gone (404)");

  const logout = await call("POST", "/api/v1/auth/logout", undefined, jar);
  assert(logout.status === 200, "logout → 200");
  const after = await call("GET", "/api/v1/me", undefined, jar);
  assert(after.status === 401, "session revoked after logout");

  console.log("\nSmoke test complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
