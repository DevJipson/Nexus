import type {
  CalendarEventType,
  Priority,
  ProjectStatus,
  TaskLabel,
  TaskStatus,
} from "@/types/domain";

/**
 * Tone names map to semantic CSS tokens so status language stays consistent
 * across pills, charts, calendars and analytics.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export interface MetaEntry {
  label: string;
  tone: Tone;
}

export const PROJECT_STATUS_META: Record<ProjectStatus, MetaEntry> = {
  planning: { label: "Planning", tone: "neutral" },
  active: { label: "Active", tone: "info" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export const TASK_STATUS_META: Record<
  TaskStatus,
  MetaEntry & { progress: number }
> = {
  backlog: { label: "Backlog", tone: "neutral", progress: 0 },
  todo: { label: "To do", tone: "info", progress: 20 },
  in_progress: { label: "In progress", tone: "warning", progress: 55 },
  in_review: { label: "In review", tone: "accent", progress: 80 },
  done: { label: "Done", tone: "success", progress: 100 },
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const PRIORITY_META: Record<Priority, MetaEntry & { rank: number }> = {
  low: { label: "Low", tone: "neutral", rank: 1 },
  medium: { label: "Medium", tone: "info", rank: 2 },
  high: { label: "High", tone: "warning", rank: 3 },
  urgent: { label: "Urgent", tone: "danger", rank: 4 },
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

export const EVENT_TYPE_META: Record<CalendarEventType, MetaEntry> = {
  meeting: { label: "Meeting", tone: "info" },
  deadline: { label: "Deadline", tone: "danger" },
  milestone: { label: "Milestone", tone: "success" },
  focus: { label: "Focus block", tone: "accent" },
};

export const TASK_LABEL_META: Record<
  TaskLabel,
  { label: string; hue: number }
> = {
  design: { label: "Design", hue: 280 },
  frontend: { label: "Frontend", hue: 264 },
  backend: { label: "Backend", hue: 210 },
  research: { label: "Research", hue: 168 },
  bug: { label: "Bug", hue: 25 },
  infra: { label: "Infra", hue: 235 },
  content: { label: "Content", hue: 70 },
  qa: { label: "QA", hue: 340 },
  growth: { label: "Growth", hue: 120 },
  ops: { label: "Ops", hue: 300 },
};

export const TASK_LABELS = Object.keys(TASK_LABEL_META) as TaskLabel[];

export function toneVar(tone: Tone): string {
  switch (tone) {
    case "info":
      return "var(--info)";
    case "success":
      return "var(--success)";
    case "warning":
      return "var(--warning)";
    case "danger":
      return "var(--danger)";
    case "accent":
      return "var(--primary)";
    default:
      return "var(--muted-foreground)";
  }
}
