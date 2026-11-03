import { beforeEach, describe, expect, it } from "vitest";
import { createSeedState } from "@/data/seed";
import { useWorkspaceStore } from "@/store/workspace-store";

const WORKSPACE = "ws-studio";

function store() {
  return useWorkspaceStore.getState();
}

beforeEach(() => {
  store().resetDemoData();
});

describe("resetDemoData", () => {
  it("restores the seeded task and project counts", () => {
    const seeded = createSeedState();
    expect(Object.keys(store().tasks)).toHaveLength(Object.keys(seeded.tasks).length);
    expect(Object.keys(store().projects)).toHaveLength(Object.keys(seeded.projects).length);
  });
});

describe("createTask", () => {
  it("adds a task and logs creation activity", () => {
    const before = Object.keys(store().tasks).length;
    const task = store().createTask({ projectId: "p-atlas", title: "Wire the onboarding checklist" });

    expect(task.id).toBeTruthy();
    expect(Object.keys(store().tasks)).toHaveLength(before + 1);
    expect(store().tasks[task.id].title).toBe("Wire the onboarding checklist");
    expect(
      Object.values(store().activity).some(
        (entry) => entry.kind === "task.created" && entry.entityId === task.id,
      ),
    ).toBe(true);
  });

  it("assigns the next order within the target column", () => {
    const created = store().createTask({ projectId: "p-atlas", title: "Column order probe" });
    const sameColumn = Object.values(store().tasks)
      .filter((task) => task.workspaceId === WORKSPACE && task.status === created.status)
      .sort((a, b) => a.order - b.order);
    const orders = sameColumn.map((task) => task.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(sameColumn[sameColumn.length - 1]?.id).toBe(created.id);
  });
});

describe("updateTask status transitions", () => {
  it("stamps completedAt when a task is finished and clears it on reopen", () => {
    const target = Object.values(store().tasks).find(
      (task) => task.workspaceId === WORKSPACE && task.status !== "done",
    );
    expect(target).toBeDefined();

    store().updateTask(target!.id, { status: "done" });
    const finished = store().tasks[target!.id];
    expect(finished.completedAt).not.toBeNull();

    store().updateTask(target!.id, { status: "todo" });
    expect(store().tasks[target!.id].completedAt).toBeNull();
  });
});

describe("moveTask", () => {
  it("sets completedAt when moved into done and clears it when moved out", () => {
    const target = Object.values(store().tasks).find(
      (task) => task.workspaceId === WORKSPACE && task.status === "todo",
    );
    expect(target).toBeDefined();

    store().moveTask(target!.id, "done", 0);
    expect(store().tasks[target!.id].status).toBe("done");
    expect(store().tasks[target!.id].completedAt).not.toBeNull();

    store().moveTask(target!.id, "in_progress", 0);
    expect(store().tasks[target!.id].status).toBe("in_progress");
    expect(store().tasks[target!.id].completedAt).toBeNull();
  });

  it("reindexes the destination column sequentially", () => {
    const target = Object.values(store().tasks).find(
      (task) => task.workspaceId === WORKSPACE && task.status === "backlog",
    );
    expect(target).toBeDefined();

    store().moveTask(target!.id, "in_progress", 0);
    const column = Object.values(store().tasks)
      .filter((task) => task.workspaceId === WORKSPACE && task.status === "in_progress")
      .sort((a, b) => a.order - b.order);
    expect(column.map((task) => task.order)).toEqual(column.map((_, index) => index + 1));
    expect(column[0]?.id).toBe(target!.id);
  });
});

describe("subtasks and comments", () => {
  it("adds and toggles subtasks", () => {
    const target = Object.values(store().tasks)[0]!;
    const before = target.subtasks.length;
    store().addSubtask(target.id, "Draft acceptance criteria");

    const withSubtask = store().tasks[target.id]!;
    expect(withSubtask.subtasks).toHaveLength(before + 1);
    const subtask = withSubtask.subtasks[withSubtask.subtasks.length - 1]!;
    expect(subtask.title).toBe("Draft acceptance criteria");
    expect(subtask.done).toBe(false);

    store().toggleSubtask(target.id, subtask.id);
    const toggled = store().tasks[target.id]!;
    expect(toggled.subtasks[toggled.subtasks.length - 1]!.done).toBe(true);
  });

  it("appends comments authored by the given member", () => {
    const target = Object.values(store().tasks)[0]!;
    const before = target.comments.length;

    store().addComment(target.id, "m-maya", "Shipping this behind a flag first.");
    const updated = store().tasks[target.id]!;
    expect(updated.comments).toHaveLength(before + 1);
    expect(updated.comments[updated.comments.length - 1]).toMatchObject({
      authorId: "m-maya",
      body: "Shipping this behind a flag first.",
    });
  });
});

describe("messages and notifications", () => {
  it("appends a sent message to the conversation", () => {
    const conversation = Object.values(store().conversations)[0]!;
    const before = conversation.messages.length;

    store().sendMessage(conversation.id, "m-maya", "On it — looking now.");
    const updated = store().conversations[conversation.id]!;
    expect(updated.messages).toHaveLength(before + 1);
    expect(updated.messages[updated.messages.length - 1]).toMatchObject({
      authorId: "m-maya",
      body: "On it — looking now.",
    });
  });

  it("marks individual and all notifications read", () => {
    const unread = Object.values(store().notifications).filter(
      (notification) => notification.workspaceId === WORKSPACE && !notification.read,
    );
    expect(unread.length).toBeGreaterThan(0);

    store().markNotificationRead(unread[0]!.id);
    expect(store().notifications[unread[0]!.id]!.read).toBe(true);

    store().markAllNotificationsRead(WORKSPACE);
    expect(
      Object.values(store().notifications).some(
        (notification) => notification.workspaceId === WORKSPACE && !notification.read,
      ),
    ).toBe(false);
  });
});

describe("createConversation", () => {
  it("creates a group thread with an optional first message", () => {
    const conversation = store().createConversation({
      kind: "group",
      name: "Launch war room",
      participantIds: ["m-maya", "m-tomas"],
      projectId: "p-atlas",
      firstMessage: "Kickoff at 10:00.",
    });

    expect(store().conversations[conversation.id]?.name).toBe("Launch war room");
    expect(store().conversations[conversation.id]?.messages.map((m) => m.body)).toContain(
      "Kickoff at 10:00.",
    );
  });
});

describe("persistence", () => {
  it("writes the dataset envelope to localStorage on mutation", () => {
    store().createTask({ projectId: "p-atlas", title: "Persist me" });

    const raw = globalThis.localStorage.getItem("nexus:data:v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as {
      state: { version: number; tasks: Record<string, unknown> };
      version: number;
    };
    expect(parsed.state.version).toBe(1);
    expect(Object.values(parsed.state.tasks)).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Persist me" })]),
    );
  });
});
