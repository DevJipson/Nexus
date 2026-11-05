"use client";

import { format, parseISO } from "date-fns";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PriorityIndicator, StatusPill } from "@/components/shared/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "@/lib/domain-meta";
import { isTaskOverdue } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useDataSource } from "@/lib/use-data-source";
import { useTaskPanelStore } from "@/store/task-panel-store";
import type { Member, Task } from "@/types/domain";

export function TaskTable({
  tasks,
  members,
  now,
}: {
  tasks: Task[];
  members: Member[];
  now: Date;
}) {
  const ds = useDataSource();
  const openTask = useTaskPanelStore((store) => store.open);

  if (tasks.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
      <table className="w-full min-w-[920px] border-collapse">
        <caption className="sr-only">All tasks in this workspace</caption>
        <thead>
          <tr className="border-b border-border/70 bg-surface/50 text-left">
            <th scope="col" className="w-10 px-4 py-2.5">
              <span className="sr-only">Done</span>
            </th>
            <th scope="col" className="px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
              Task
            </th>
            <th scope="col" className="px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
              Priority
            </th>
            <th scope="col" className="px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
              Assignee
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
              Due
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const project = ds.projects[task.projectId];
            const assignee = task.assigneeId ? ds.members[task.assigneeId] ?? null : null;
            const overdue = isTaskOverdue(task, now);
            const done = task.status === "done";

            return (
              <tr
                key={task.id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-2.5">
                  <Checkbox
                    checked={done}
                    onCheckedChange={() =>
                      void ds.updateTask(task.id, { status: done ? "todo" : "done" })
                    }
                    aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  />
                </td>
                <td className="max-w-80 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="block w-full text-left outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  >
                    <span
                      className={cn(
                        "block truncate text-[12.5px] font-medium hover:text-primary",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: `oklch(0.62 0.14 ${project?.colorHue ?? 264})` }}
                      />
                      {project?.key ?? "—"}
                      {task.labels.length > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="normal-case tracking-normal">
                            {task.labels.slice(0, 2).join(", ")}
                            {task.labels.length > 2 ? ` +${task.labels.length - 2}` : ""}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={task.status}
                    onValueChange={(value) =>
                      void ds.updateTask(task.id, { status: value as Task["status"] })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Task status"
                      className="-ml-1.5 w-auto border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent"
                    >
                      <StatusPill
                        label={TASK_STATUS_META[task.status].label}
                        tone={TASK_STATUS_META[task.status].tone}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {TASK_STATUS_META[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={task.priority}
                    onValueChange={(value) =>
                      void ds.updateTask(task.id, { priority: value as Task["priority"] })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Task priority"
                      className="-ml-1.5 w-auto border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent"
                    >
                      <PriorityIndicator priority={task.priority} withLabel />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_ORDER.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_META[priority].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={task.assigneeId ?? "unassigned"}
                    onValueChange={(value) =>
                      void ds.updateTask(task.id, {
                        assigneeId: value === "unassigned" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Assignee"
                      className="-ml-1.5 w-auto max-w-40 border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent"
                    >
                      {assignee ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <EntityAvatar name={assignee.name} hue={assignee.avatarHue} size="xs" />
                          <span className="truncate text-[12px]">
                            {assignee.name.split(" ").slice(0, 2).join(" ")}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Unassigned</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right text-[11px] whitespace-nowrap",
                    overdue ? "font-medium text-danger" : "text-muted-foreground",
                  )}
                >
                  {task.dueDate ? format(parseISO(task.dueDate), "d MMM") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
