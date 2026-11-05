"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarIcon,
  CircleDotIcon,
  FlagIcon,
  FolderIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PriorityIndicator, StatusPill } from "@/components/shared/status-pill";
import { TaskAttachments } from "@/features/tasks/task-attachments";
import { TaskComments } from "@/features/tasks/task-comments";
import { TaskSubtasks } from "@/features/tasks/task-subtasks";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  TASK_LABELS,
  TASK_LABEL_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "@/lib/domain-meta";
import { formatFullDate, relativeTime } from "@/lib/format";
import { workspaceMembers } from "@/lib/selectors";
import { useDataSource } from "@/lib/use-data-source";
import { cn } from "@/lib/utils";
import { useTaskPanelStore } from "@/store/task-panel-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Member, Priority, Task, TaskLabel, TaskStatus } from "@/types/domain";

/**
 * The task detail sheet is the one place a task is edited in depth. It is
 * mounted once by the app shell and opened from the board, list, project view
 * and command palette through `useTaskPanelStore`.
 */
export function TaskDetailSheet() {
  const taskId = useTaskPanelStore((state) => state.taskId);
  const close = useTaskPanelStore((state) => state.close);
  const ds = useDataSource();
  const state = useWorkspaceStore();
  const task = useWorkspaceStore((state) => (taskId ? state.tasks[taskId] : undefined));

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {task ? <TaskDetailBody key={task.id} task={task} onClose={close} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const ds = useDataSource();
  const state = useWorkspaceStore();
  const project = ds.projects[task.projectId];
  const members = ds.workspaceMembers(ds.activeWorkspaceId ?? "");
  const currentUser = ds.members[ds.currentUserId ?? ""] ?? null;
  const membersById = ds.members;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [labelOpen, setLabelOpen] = useState(false);

  const commitTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      return;
    }
    if (next !== task.title) void ds.updateTask(task.id, { title: next });
  };

  const commitDescription = () => {
    if (description !== task.description) void ds.updateTask(task.id, { description });
  };

  const toggleLabel = (label: TaskLabel) => {
    const next = task.labels.includes(label)
      ? task.labels.filter((item) => item !== label)
      : [...task.labels, label];
    void ds.updateTask(task.id, { labels: next });
  };

  const setDueDate = (value: string) => {
    void ds.updateTask(task.id, {
      dueDate: value ? new Date(`${value}T17:00:00`).toISOString() : null,
    });
  };

  const remove = () => {
    void ds.deleteTask(task.id);
    onClose();
  };

  const isDone = task.status === "done";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border/70 px-5 py-4 pr-14 sm:px-6 sm:pr-16">
        <div className="flex items-center gap-2 text-[10.5px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
          {project ? (
            <Link
              href={`/projects/${project.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
              />
              {project.key}
            </Link>
          ) : (
            <span>Task</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="tnum">#{task.order.toString().padStart(2, "0")}</span>
        </div>

        <SheetTitle className="sr-only">{task.title}</SheetTitle>

        <Textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setTitle(task.title);
              event.currentTarget.blur();
            }
          }}
          rows={1}
          aria-label="Task title"
          className="mt-2 min-h-0 resize-none border-transparent bg-transparent px-0 py-0 text-[19px] leading-[1.3] font-medium shadow-none field-sizing-content focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
          <span>Created {formatFullDate(task.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {relativeTime(task.updatedAt)}</span>
          {task.completedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Completed {relativeTime(task.completedAt)}</span>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 sm:px-6">
          <div className="space-y-0.5">
            <PropertyRow icon={CircleDotIcon} label="Status">
              <Select
                value={task.status}
                onValueChange={(value) =>
                  void ds.updateTask(task.id, { status: value as TaskStatus })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Task status"
                  className="-ml-1.5 w-auto gap-1.5 border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent dark:hover:bg-muted/60"
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
            </PropertyRow>

            <PropertyRow icon={FlagIcon} label="Priority">
              <Select
                value={task.priority}
                onValueChange={(value) =>
                  void ds.updateTask(task.id, { priority: value as Priority })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Task priority"
                  className="-ml-1.5 w-auto gap-1.5 border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent dark:hover:bg-muted/60"
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
            </PropertyRow>

            <PropertyRow icon={UserIcon} label="Assignee">
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
                  aria-label="Task assignee"
                  className="-ml-1.5 w-auto max-w-full gap-1.5 border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent dark:hover:bg-muted/60"
                >
                  <AssigneeValue
                    member={task.assigneeId ? membersById[task.assigneeId] : null}
                  />
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
            </PropertyRow>

            <PropertyRow icon={CalendarIcon} label="Due date">
              <Input
                type="date"
                aria-label="Due date"
                value={task.dueDate ? format(parseISO(task.dueDate), "yyyy-MM-dd") : ""}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-7 w-[152px] border-transparent bg-transparent px-1.5 text-[12.5px] shadow-none hover:bg-muted focus-visible:bg-background dark:bg-transparent"
              />
            </PropertyRow>

            <PropertyRow icon={FolderIcon} label="Project">
              {project ? (
                <Link
                  href={`/projects/${project.id}`}
                  onClick={onClose}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] transition-colors hover:bg-muted"
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              ) : (
                <span className="text-[12.5px] text-muted-foreground">No project</span>
              )}
            </PropertyRow>

            <PropertyRow icon={TagIcon} label="Labels">
              <div className="flex flex-wrap items-center gap-1.5">
                {task.labels.length === 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">None</span>
                ) : (
                  task.labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border/70 bg-surface px-1.5 text-[11px] font-medium"
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full"
                        style={{
                          backgroundColor: `oklch(0.62 0.13 ${TASK_LABEL_META[label].hue})`,
                        }}
                      />
                      {TASK_LABEL_META[label].label}
                    </span>
                  ))
                )}
                <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Edit labels"
                      className="text-muted-foreground"
                    >
                      <TagIcon className="size-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-1.5">
                    <p className="px-1.5 py-1 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
                      Labels
                    </p>
                    <ul>
                      {TASK_LABELS.map((label) => {
                        const active = task.labels.includes(label);
                        return (
                          <li key={label}>
                            <button
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleLabel(label)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] transition-colors hover:bg-muted",
                                active && "bg-muted/60",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className="size-1.5 rounded-full"
                                style={{
                                  backgroundColor: `oklch(0.62 0.13 ${TASK_LABEL_META[label].hue})`,
                                }}
                              />
                              <span className="flex-1">{TASK_LABEL_META[label].label}</span>
                              {active ? (
                                <XIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
            </PropertyRow>
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2">Description</p>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={commitDescription}
              rows={3}
              aria-label="Task description"
              placeholder="What does done look like?"
              className="min-h-20 resize-none border-transparent bg-surface/50 px-3 py-2.5 text-[12.5px] leading-relaxed shadow-none focus-visible:bg-background dark:bg-input/20"
            />
          </div>

          <div className="mt-6 space-y-6">
            <TaskSubtasks
              task={task}
              onToggle={(subtaskId) => void ds.toggleSubtask(task.id, subtaskId)}
              onAdd={(subtaskTitle) => void ds.addSubtask(task.id, subtaskTitle)}
            />
            <TaskAttachments
              attachments={task.attachments}
              onAdd={(input) => void ds.addAttachment(task.id, input)}
            />
            <TaskComments
              task={task}
              membersById={membersById}
              currentUser={currentUser}
              onSend={(body) => void ds.addComment(task.id, state.currentUserId, body)}
            />
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border/70 bg-surface/40 px-5 py-3 sm:px-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>
                “{task.title}” and its {task.subtasks.length} subtasks and{" "}
                {task.comments.length} comments will be removed from this browser. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep task</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Delete task</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            variant={isDone ? "outline" : "default"}
            onClick={() =>
              void ds.updateTask(task.id, { status: isDone ? "in_progress" : "done" })
            }
          >
            {isDone ? "Reopen task" : "Mark as done"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CircleDotIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span className="flex w-[96px] shrink-0 items-center gap-2 text-[11.5px] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AssigneeValue({ member }: { member: Member | null }) {
  if (!member) {
    return <span className="text-[12.5px] text-muted-foreground">Unassigned</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <EntityAvatar name={member.name} hue={member.avatarHue} size="xs" />
      <span className="truncate text-[12.5px]">{member.name}</span>
    </span>
  );
}
