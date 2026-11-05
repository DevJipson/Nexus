"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircle2Icon,
  FlagIcon,
  FolderKanbanIcon,
  ListTodoIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { TaskRow } from "@/components/shared/task-row";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { StatusPill, PriorityIndicator } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  PROJECT_STATUS_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "@/lib/domain-meta";
import { formatFullDate, relativeTime } from "@/lib/format";
import { sortTasksForBoard, taskStats } from "@/lib/selectors";
import { liveListActivity } from "@/lib/live-work";
import { useDataSource, useDataSourceSelectors } from "@/lib/use-data-source";
import { cn } from "@/lib/utils";
import { useComposeStore } from "@/store/compose-store";
import { useTaskPanelStore } from "@/store/task-panel-store";
import type {
  ActivityEntry,
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@/types/domain";

const ACTIVITY_VERB: Record<ActivityEntry["kind"], string> = {
  "project.created": "created this project",
  "project.updated": "updated this project",
  "project.completed": "completed this project",
  "task.created": "created task",
  "task.updated": "updated task",
  "task.completed": "completed task",
  "task.assigned": "assigned task",
  "comment.created": "commented on",
  "event.created": "scheduled",
  "member.joined": "joined the workspace",
};

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ds = useDataSource();
  const { sortTasksForBoard, taskStats: computeTaskStats } = useDataSourceSelectors();
  const openComposer = useComposeStore((state) => state.open);
  const openTask = useTaskPanelStore((store) => store.open);
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all">("all");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const now = new Date();
  const project = ds.projects[projectId];

  const shouldLoadActivity = ds.mode === "live" && !!project?.workspaceId;
  const [activityLoading, setActivityLoading] = useState(shouldLoadActivity);

  // Load activity for this project (live mode only).
  useEffect(() => {
    if (!project || ds.mode !== "live" || !project.workspaceId) return;
    void liveListActivity(project.workspaceId, { projectId, limit: 50 }).then(
      (entries) => {
        setActivity(
          entries.filter(
            (e) => e.projectId === project.id || e.entityId === project.id,
          ),
        );
        setActivityLoading(false);
      },
      () => {
        setActivity([]);
        setActivityLoading(false);
      },
    );
  }, [project, ds.mode, projectId]);

  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/projects">
            <ArrowLeftIcon className="size-3.5" />
            All projects
          </Link>
        </Button>
        <EmptyState
          icon={FolderKanbanIcon}
          title="Project not found"
          description="It may have been deleted, or this profile belongs to a different workspace."
          action={
            <Button size="sm" asChild>
              <Link href="/projects">Back to projects</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const allTasks = sortTasksForBoard(ds.projectTasks(project.id));
  const visibleTasks =
    taskFilter === "all"
      ? [...allTasks].sort((a, b) => {
          const aDone = a.status === "done" ? 1 : 0;
          const bDone = b.status === "done" ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return TASK_STATUS_ORDER.indexOf(a.status) - TASK_STATUS_ORDER.indexOf(b.status);
        })
      : allTasks.filter((task) => task.status === taskFilter);

  const members = project.memberIds
    .map((id: string) => ds.members[id])
    .filter((member: any): member is NonNullable<typeof member> => Boolean(member));

  const openByMember = new Map<string, number>();
  for (const task of allTasks) {
    if (!task.assigneeId || task.status === "done") continue;
    openByMember.set(task.assigneeId, (openByMember.get(task.assigneeId) ?? 0) + 1);
  }

  const stats = computeTaskStats(project, now);

  const meta = PROJECT_STATUS_META[project.status as ProjectStatus];
  const due = parseISO(project.dueDate);
  const overdue = project.status !== "completed" && due.getTime() < now.getTime();
  const counts: Record<TaskStatus, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
  };
  for (const task of allTasks) counts[task.status] += 1;

  const activateStatus = (status: ProjectStatus) => {
    void ds.updateProject(project.id, { status });
  };
  const setPriority = (priority: Priority) => {
    void ds.updateProject(project.id, { priority });
  };
  const setDueDate = (value: string) => {
    void ds.updateProject(project.id, {
      dueDate: value ? new Date(`${value}T17:00:00`).toISOString() : project.dueDate,
    });
  };

  return (
    <div className="space-y-7">
      <div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/projects">
            <ArrowLeftIcon className="size-3.5" />
            All projects
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
            />
            {project.key} · Project
          </span>
        }
        title={project.name}
        description={project.description}
        actions={
          <Button onClick={() => openComposer("task", { projectId: project.id })}>
            <PlusIcon className="size-4" />
            New task
          </Button>
        }
        meta={
          <>
            <StatusPill label={meta.label} tone={meta.tone} />
            <PriorityIndicator priority={project.priority} withLabel />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11.5px]",
                overdue ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              Due {formatFullDate(project.dueDate)}
              {overdue ? " · overdue" : ""}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              Started {formatFullDate(project.startDate)}
            </span>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Completion"
          value={`${stats.completionRate}%`}
          detail={`${stats.done} of ${stats.total} tasks done`}
          icon={CheckCircle2Icon}
          tone="accent"
        />
        <StatTile
          label="Open tasks"
          value={String(stats.open)}
          detail={`${stats.inProgress} in progress or review`}
          icon={ListTodoIcon}
        />
        <StatTile
          label="Overdue"
          value={String(stats.overdue)}
          detail={stats.overdue > 0 ? "Needs a decision today" : "Nothing has slipped"}
          tone={stats.overdue > 0 ? "negative" : "positive"}
          icon={TriangleAlertIcon}
        />
        <StatTile
          label="Team"
          value={String(members.length)}
          detail="Members assigned to this project"
          icon={UsersIcon}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="gap-0">
          <CardHeader className="border-b border-border/70 pb-4">
            <p className="eyebrow mb-2">Scope</p>
            <CardTitle>Tasks</CardTitle>
            <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
              <Button size="icon-xs" variant="outline" aria-label="Add task" onClick={() => openComposer("task", { projectId: project.id })}>
                <PlusIcon className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <div
            role="tablist"
            aria-label="Filter tasks by status"
            className="flex flex-wrap gap-1 border-b border-border/70 px-3 py-2"
          >
            <FilterChip
              label={`All ${allTasks.length}`}
              active={taskFilter === "all"}
              onClick={() => setTaskFilter("all")}
            />
            {TASK_STATUS_ORDER.map((status) => (
              <FilterChip
                key={status}
                label={`${TASK_STATUS_META[status].label} ${counts[status]}`}
                active={taskFilter === status}
                onClick={() => setTaskFilter(status)}
              />
            ))}
          </div>
          <CardContent className="px-2 pt-1 pb-2">
            {visibleTasks.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                {allTasks.length === 0
                  ? "No tasks yet. Create the first one and give this project a spine."
                  : "No tasks in this status."}
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={project}
                    assignee={task.assigneeId ? ds.members[task.assigneeId] ?? null : null}
                    now={now}
                    onOpen={() => openTask(task.id)}
                    onToggle={() =>
                      void ds.updateTask(task.id, {
                        status: task.status === "done" ? "todo" : "done",
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Project</p>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <DetailRow icon={FlagIcon} label="Status">
                <Select value={project.status} onValueChange={(value) => activateStatus(value as ProjectStatus)}>
                  <SelectTrigger size="sm" aria-label="Project status" className="-ml-1.5 w-auto border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent">
                    <StatusPill label={meta.label} tone={meta.tone} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROJECT_STATUS_META[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DetailRow>

              <DetailRow icon={FlagIcon} label="Priority">
                <Select value={project.priority} onValueChange={(value) => setPriority(value as Priority)}>
                  <SelectTrigger size="sm" aria-label="Project priority" className="-ml-1.5 w-auto border-transparent bg-transparent px-1.5 hover:bg-muted dark:bg-transparent">
                    <PriorityIndicator priority={project.priority} withLabel />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_META[priority].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DetailRow>

              <DetailRow icon={CalendarIcon} label="Due date">
                <Input
                  type="date"
                  aria-label="Project due date"
                  value={format(parseISO(project.dueDate), "yyyy-MM-dd")}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-7 w-[152px] border-transparent bg-transparent px-1.5 text-[12.5px] shadow-none hover:bg-muted focus-visible:bg-background dark:bg-transparent"
                />
              </DetailRow>

              <DetailRow icon={CheckCircle2Icon} label="Progress">
                <span className="flex items-center gap-2">
                  <Progress value={stats.completionRate} className="h-1.5 w-32" aria-label="Project completion" />
                  <span className="tnum font-mono text-[11px] text-muted-foreground">
                    {stats.completionRate}%
                  </span>
                </span>
              </DetailRow>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Team</p>
              <CardTitle>Who is on this</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-2">
              {members.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-muted-foreground">
                  No members yet. Editing the project will let you add people.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {members.map((member: any) => (
                    <li key={member.id} className="flex items-center gap-2.5 py-2.5">
                      <EntityAvatar
                        name={member.name}
                        hue={member.avatarHue}
                        size="sm"
                        presence={member.presence}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium">{member.name}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">{member.title}</p>
                      </div>
                      <span className="tnum font-mono text-[10.5px] text-muted-foreground">
                        {openByMember.get(member.id) ?? 0} open
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Activity</p>
              <CardTitle>What changed</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-2">
              {activityLoading ? (
                <p className="py-5 text-center text-[12px] text-muted-foreground">Loading activity…</p>
              ) : activity.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-muted-foreground">
                  No activity recorded for this project yet.
                </p>
              ) : (
                <ul className="space-y-2.5 pt-1">
                  {activity.map((entry) => {
                    const actor = ds.members[entry.actorId];
                    return (
                      <li key={entry.id} className="flex items-start gap-2.5">
                        <EntityAvatar
                          name={actor?.name ?? "Someone"}
                          hue={actor?.avatarHue ?? 264}
                          size="xs"
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {actor?.name ?? "Someone"}
                            </span>{" "}
                            {ACTIVITY_VERB[entry.kind]}{" "}
                            {entry.entityId !== project.id ? (
                              <button
                                type="button"
                                onClick={() => openTask(entry.entityId)}
                                className="font-medium text-foreground underline-offset-2 hover:underline"
                              >
                                {entry.entityLabel}
                              </button>
                            ) : null}
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] tracking-[0.08em] text-muted-foreground/70 uppercase">
                            {relativeTime(entry.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-danger hover:text-danger">
                <Trash2Icon className="size-3.5" />
                Delete project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the project and its {allTasks.length}{" "}
                  {allTasks.length === 1 ? "task" : "tasks"} from this browser. Linked
                  events and comments will be detached, not deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep project</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void ds.deleteProject(project.id);
                    router.push("/projects");
                  }}
                >
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "tnum inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof FlagIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span className="flex w-[88px] shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
