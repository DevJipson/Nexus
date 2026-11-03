"use client";

import { format, isTomorrow, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PriorityIndicator } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { isTaskDueToday, isTaskOverdue } from "@/lib/selectors";
import type { Member, Project, Task } from "@/types/domain";

function dueLabel(task: Task, now: Date): string | null {
  if (!task.dueDate) return null;
  const due = parseISO(task.dueDate);
  if (task.status === "done") return format(due, "d MMM");
  if (isTaskOverdue(task, now)) return `Overdue · ${format(due, "d MMM")}`;
  if (isTaskDueToday(task, now)) return "Due today";
  if (isTomorrow(due)) return "Due tomorrow";
  return format(due, "d MMM");
}

export function TaskRow({
  task,
  project,
  assignee,
  onOpen,
  onToggle,
  now,
  className,
}: {
  task: Task;
  project: Project | null;
  assignee: Member | null;
  onOpen: () => void;
  onToggle: () => void;
  now: Date;
  className?: string;
}) {
  const done = task.status === "done";
  const overdue = isTaskOverdue(task, now);
  const due = dueLabel(task, now);

  return (
    <li className={cn("group flex items-start gap-3 px-2 py-2.5", className)}>
      <Checkbox
        checked={done}
        onCheckedChange={onToggle}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className="mt-[3px]"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span
            className={cn(
              "block truncate text-[12.5px] leading-snug font-medium transition-colors group-hover:text-primary",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
          {project ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
              />
              <span className="font-mono tracking-[0.08em] uppercase">{project.key}</span>
            </span>
          ) : null}
          {due ? (
            <>
              <span aria-hidden="true" className="text-muted-foreground/40">
                ·
              </span>
              <span className={cn(overdue && "font-medium text-danger")}>{due}</span>
            </>
          ) : null}
          {task.subtasks.length > 0 ? (
            <>
              <span aria-hidden="true" className="text-muted-foreground/40">
                ·
              </span>
              <span className="tnum font-mono">
                {task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <PriorityIndicator priority={task.priority} />
        {assignee ? (
          <EntityAvatar name={assignee.name} hue={assignee.avatarHue} size="sm" />
        ) : (
          <span
            aria-label="Unassigned"
            className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border text-[9px] text-muted-foreground"
          >
            ?
          </span>
        )}
      </div>
    </li>
  );
}
