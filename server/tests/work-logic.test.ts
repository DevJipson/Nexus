import { describe, expect, it } from "vitest";
import { computeTaskStats } from "../src/modules/projects/projects.service";
import { baseProjectKey } from "../src/modules/projects/project-key";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function task(status: string, dueDate: Date | null) {
  return {
    status: status as never,
    due_date: dueDate,
    completed_at: status === "done" ? new Date("2026-06-10T09:00:00.000Z") : null,
  };
}

describe("computeTaskStats", () => {
  it("returns a zeroed shape for an empty set", () => {
    expect(computeTaskStats([], NOW)).toEqual({
      total: 0,
      done: 0,
      open: 0,
      inProgress: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      completionRate: 0,
    });
  });

  it("counts done, open, in-progress (in_review included) and completion rate", () => {
    const stats = computeTaskStats(
      [
        task("done", null),
        task("done", null),
        task("in_progress", null),
        task("in_review", null),
        task("todo", null),
      ],
      NOW,
    );
    expect(stats.total).toBe(5);
    expect(stats.done).toBe(2);
    expect(stats.open).toBe(3);
    expect(stats.inProgress).toBe(2);
    expect(stats.completionRate).toBe(40);
  });

  it("counts overdue, due-today and due-this-week for open tasks only", () => {
    const stats = computeTaskStats(
      [
        task("todo", new Date("2026-06-10T17:00:00.000Z")), // overdue
        task("todo", new Date("2026-06-15T17:00:00.000Z")), // due today
        task("todo", new Date("2026-06-18T17:00:00.000Z")), // within 7 days
        task("todo", new Date("2026-07-15T17:00:00.000Z")), // far future
        task("done", new Date("2026-06-10T17:00:00.000Z")), // done → ignored
      ],
      NOW,
    );
    expect(stats.overdue).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.dueThisWeek).toBe(2); // today + within 7 days
  });
});

describe("baseProjectKey", () => {
  it("uses the first three alphabetic characters uppercased", () => {
    expect(baseProjectKey("Atlas design language")).toBe("ATL");
    expect(baseProjectKey("Meridian mobile app")).toBe("MER");
  });

  it("strips non-letters and falls back to PRJ", () => {
    expect(baseProjectKey("123 456")).toBe("PRJ");
    expect(baseProjectKey("a-b-c-rest")).toBe("ABC");
    expect(baseProjectKey("")).toBe("PRJ");
  });
});
