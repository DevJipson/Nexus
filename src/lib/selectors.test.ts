import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedState } from "@/data/seed";
import {
  averageCycleTimeDays,
  completionSeries,
  filterTasks,
  groupTasksByStatus,
  isTaskDueWithin,
  isTaskOverdue,
  rankTasks,
  statusSeries,
  taskStats,
  workspaceOverview,
  workspaceTasks,
} from "@/lib/selectors";
import { TASK_STATUS_ORDER } from "@/lib/domain-meta";
import type { Task, TaskFilters } from "@/types/domain";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: "ws-studio",
    projectId: "p-atlas",
    title: "Ship the thing",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: "m-maya",
    reporterId: "m-maya",
    dueDate: null,
    labels: [],
    order: 1,
    subtasks: [],
    comments: [],
    attachments: [],
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const ALL: TaskFilters = {
  search: "",
  assigneeId: "all",
  priority: "all",
  projectId: "all",
  label: "all",
};

describe("isTaskOverdue", () => {
  it("flags open tasks whose due date has passed", () => {
    expect(isTaskOverdue(makeTask({ dueDate: "2026-06-10T17:00:00.000Z" }), NOW)).toBe(true);
    expect(isTaskOverdue(makeTask({ dueDate: "2026-06-20T17:00:00.000Z" }), NOW)).toBe(false);
  });

  it("never flags completed tasks", () => {
    expect(
      isTaskOverdue(
        makeTask({ status: "done", dueDate: "2026-06-01T17:00:00.000Z" }),
        NOW,
      ),
    ).toBe(false);
  });

  it("treats missing due dates as never overdue", () => {
    expect(isTaskOverdue(makeTask({ dueDate: null }), NOW)).toBe(false);
  });
});

describe("isTaskDueWithin", () => {
  it("counts tasks due between start of today and N days out", () => {
    // Avoid exact boundary instants — the window is anchored to local start of day.
    const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
    expect(isTaskDueWithin(makeTask({ dueDate: inDays(0) }), 7, NOW)).toBe(true);
    expect(isTaskDueWithin(makeTask({ dueDate: inDays(3) }), 7, NOW)).toBe(true);
    expect(isTaskDueWithin(makeTask({ dueDate: inDays(6) }), 7, NOW)).toBe(true);
    expect(isTaskDueWithin(makeTask({ dueDate: inDays(8) }), 7, NOW)).toBe(false);
    expect(isTaskDueWithin(makeTask({ dueDate: inDays(-1) }), 7, NOW)).toBe(false);
  });
});

describe("rankTasks", () => {
  it("excludes done tasks", () => {
    const ranked = rankTasks([makeTask({ status: "done" })], NOW);
    expect(ranked).toHaveLength(0);
  });

  it("puts overdue work first, then priority rank", () => {
    const overdueLow = makeTask({
      id: "overdue-low",
      priority: "low",
      dueDate: "2026-06-01T00:00:00.000Z",
    });
    const urgentFuture = makeTask({
      id: "urgent-future",
      priority: "urgent",
      dueDate: "2026-07-01T00:00:00.000Z",
    });
    const highFuture = makeTask({
      id: "high-future",
      priority: "high",
      dueDate: "2026-07-02T00:00:00.000Z",
    });

    const ranked = rankTasks([urgentFuture, highFuture, overdueLow], NOW);
    expect(ranked.map((task) => task.id)).toEqual([
      "overdue-low",
      "urgent-future",
      "high-future",
    ]);
  });
});

describe("filterTasks", () => {
  const tasks = [
    makeTask({ id: "a", title: "Fix nav focus ring", assigneeId: "m-maya" }),
    makeTask({ id: "b", title: "Write release notes", assigneeId: null, priority: "high" }),
    makeTask({ id: "c", title: "Design onboarding", assigneeId: "m-maya", labels: ["design"] }),
  ];

  it("matches search against title", () => {
    expect(filterTasks(tasks, { ...ALL, search: "release" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("filters unassigned tasks", () => {
    expect(filterTasks(tasks, { ...ALL, assigneeId: "unassigned" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("filters by label", () => {
    expect(filterTasks(tasks, { ...ALL, label: "design" }).map((t) => t.id)).toEqual(["c"]);
  });
});

describe("groupTasksByStatus", () => {
  it("partitions tasks into every status column and sorts by order", () => {
    const tasks = [
      makeTask({ id: "b1", status: "todo", order: 5 }),
      makeTask({ id: "b2", status: "todo", order: 1 }),
      makeTask({ id: "b3", status: "done", order: 1 }),
    ];
    const grouped = groupTasksByStatus(tasks);
    expect(Object.keys(grouped)).toEqual(TASK_STATUS_ORDER);
    expect(grouped.todo.map((t) => t.id)).toEqual(["b2", "b1"]);
    expect(grouped.done.map((t) => t.id)).toEqual(["b3"]);
    expect(grouped.backlog).toEqual([]);
  });
});

describe("taskStats", () => {
  it("derives totals, completion rate and due-today counts", () => {
    const tasks = [
      makeTask({ status: "done", createdAt: "2026-06-01T00:00:00.000Z", completedAt: "2026-06-05T00:00:00.000Z" }),
      makeTask({ status: "done" }),
      makeTask({ dueDate: "2026-06-15T20:00:00.000Z" }),
      makeTask({ dueDate: "2026-06-01T09:00:00.000Z" }),
    ];
    const stats = taskStats(tasks, NOW);
    expect(stats.total).toBe(4);
    expect(stats.done).toBe(2);
    expect(stats.open).toBe(2);
    expect(stats.completionRate).toBe(50);
    expect(stats.overdue).toBe(1);
    expect(stats.dueToday).toBe(1);
  });

  it("returns zeroed stats for an empty list", () => {
    const stats = taskStats([], NOW);
    expect(stats).toMatchObject({ total: 0, done: 0, open: 0, completionRate: 0, overdue: 0 });
  });
});

describe("averageCycleTimeDays", () => {
  it("averages calendar days from created to completed", () => {
    const tasks = [
      makeTask({
        createdAt: "2026-06-01T00:00:00.000Z",
        completedAt: "2026-06-06T00:00:00.000Z",
      }),
      makeTask({
        createdAt: "2026-06-01T00:00:00.000Z",
        completedAt: "2026-06-11T00:00:00.000Z",
      }),
    ];
    expect(averageCycleTimeDays(tasks)).toBe(7.5);
  });

  it("returns 0 when nothing has completed", () => {
    expect(averageCycleTimeDays([makeTask()])).toBe(0);
  });
});

describe("completionSeries", () => {
  it("returns one bucket per requested week", () => {
    const series = completionSeries([], 8, NOW);
    expect(series).toHaveLength(8);
    for (const point of series) {
      expect(point.completed).toBe(0);
      expect(point.created).toBe(0);
    }
  });

  it("counts a task completed within the trailing window", () => {
    const recently = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    const series = completionSeries(
      [makeTask({ completedAt: recently, status: "done" })],
      4,
      NOW,
    );
    expect(series.reduce((sum, point) => sum + point.completed, 0)).toBe(1);
  });
});

describe("seeded workspace overview", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  it("reports stats consistent with the seeded task list", () => {
    const state = createSeedState();
    const overview = workspaceOverview(state, state.activeWorkspaceId, NOW);
    const seeded = workspaceTasks(state, state.activeWorkspaceId);

    expect(overview.tasks).toHaveLength(seeded.length);
    expect(overview.stats.total).toBe(seeded.length);
    expect(overview.activeProjects.every((project) => project.status === "active")).toBe(true);
    expect(overview.stats.done).toBe(seeded.filter((task) => task.status === "done").length);
  });

  it("statusSeries partitions every seeded task exactly once", () => {
    const state = createSeedState();
    const tasks = workspaceTasks(state, state.activeWorkspaceId);
    const totals = statusSeries(tasks).reduce((sum, point) => sum + point.count, 0);
    expect(totals).toBe(tasks.length);
  });
});
