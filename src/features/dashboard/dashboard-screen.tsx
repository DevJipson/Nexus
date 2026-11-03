"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ChartNoAxesColumnIcon,
  CheckCircle2Icon,
  FolderKanbanIcon,
  PlusIcon,
  SparklesIcon,
  SquareCheckIcon,
  TargetIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { ChartCard } from "@/components/shared/chart-card";
import { TaskRow } from "@/components/shared/task-row";
import { StatusPill } from "@/components/shared/status-pill";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { EVENT_TYPE_META } from "@/lib/domain-meta";
import { formatFullDate, formatTime, relativeTime } from "@/lib/format";
import {
  completionRateTrend,
  completionSeries,
  eventsOnDay,
  projectStats,
  rankTasks,
  workspaceOverview,
} from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useComposeStore } from "@/store/compose-store";
import { useTaskPanelStore } from "@/store/task-panel-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { ActivityEntry } from "@/types/domain";

const completionConfig = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  created: { label: "Created", color: "var(--chart-6)" },
} satisfies ChartConfig;

const ACTIVITY_VERB: Record<ActivityEntry["kind"], string> = {
  "project.created": "created project",
  "project.updated": "updated project",
  "project.completed": "completed project",
  "task.created": "created task",
  "task.updated": "updated task",
  "task.completed": "completed task",
  "task.assigned": "assigned task",
  "comment.created": "commented on",
  "event.created": "scheduled",
  "member.joined": "joined the workspace",
};

export function DashboardScreen() {
  const state = useWorkspaceStore();
  const openComposer = useComposeStore((state) => state.open);
  const openTask = useTaskPanelStore((state) => state.open);
  const now = new Date();
  const overview = workspaceOverview(state, state.activeWorkspaceId, now);
  const workspace = state.workspaces[state.activeWorkspaceId];
  const currentUser = state.members[state.currentUserId];

  if (!workspace || !currentUser) return null;

  const focus = rankTasks(
    overview.tasks.filter((task) => task.assigneeId === state.currentUserId),
    now,
  ).slice(0, 6);

  const series = completionSeries(overview.tasks, 8, now);
  const trend = completionRateTrend(overview.tasks, now);
  const todayEvents = eventsOnDay(overview.events, now);
  const upcoming = overview.events
    .filter((event) => parseISO(event.end).getTime() > now.getTime())
    .slice(0, 4);

  const portfolio = overview.activeProjects
    .map((project) => ({ project, stats: projectStats(state, project.id, now) }))
    .sort((a, b) => a.project.dueDate.localeCompare(b.project.dueDate))
    .slice(0, 4);

  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const firstName = currentUser.name.split(" ")[0];
  const updateTask = state.updateTask;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${format(now, "EEEE d MMMM")} · ${workspace.name}`}
        title={`${greeting}, ${firstName}.`}
        description={`${overview.stats.open} open ${overview.stats.open === 1 ? "task" : "tasks"} across ${overview.activeProjects.length} active ${overview.activeProjects.length === 1 ? "project" : "projects"}. Here is what deserves your attention first.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reports">
                <ChartNoAxesColumnIcon className="size-4" />
                Reports
              </Link>
            </Button>
            <Button onClick={() => openComposer("task")}>
              <PlusIcon className="size-4" />
              New task
            </Button>
          </>
        }
        meta={
          <>
            <Badge variant="soft" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              {workspace.plan} plan
            </Badge>
            <span className="text-[11.5px] text-muted-foreground">
              {overview.onlineMembers} of {overview.members.length} online
            </span>
            <span aria-hidden="true" className="text-muted-foreground/40">
              ·
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {overview.unreadNotifications} unread notifications
            </span>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open tasks"
          value={String(overview.stats.open)}
          detail={`${overview.stats.inProgress} in progress or review`}
          icon={SquareCheckIcon}
          tone="accent"
        />
        <StatTile
          label="Due this week"
          value={String(overview.stats.dueThisWeek)}
          detail={
            overview.stats.dueToday > 0
              ? `${overview.stats.dueToday} due today`
              : "Nothing due today"
          }
          icon={CalendarClockIcon}
        />
        <StatTile
          label="Overdue"
          value={String(overview.stats.overdue)}
          detail={
            overview.stats.overdue > 0 ? "Needs a decision today" : "Nothing has slipped"
          }
          icon={TriangleAlertIcon}
          tone={overview.stats.overdue > 0 ? "negative" : "positive"}
        />
        <StatTile
          label="Completion rate"
          value={`${overview.stats.completionRate}%`}
          detail={`${overview.stats.done} of ${overview.stats.total} tasks done · ${trend >= 0 ? "+" : ""}${trend}% vs last week`}
          icon={TargetIcon}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-4">
              <p className="eyebrow mb-2">Your focus</p>
              <CardTitle>Next up</CardTitle>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Ordered by overdue first, then priority and due date.
              </p>
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/tasks">
                    All tasks
                    <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pt-1 pb-2">
              {focus.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2Icon}
                  title="Nothing assigned to you"
                  description="Take something from the backlog, or create a task for the next piece of work."
                  compact
                  className="border-0 bg-transparent"
                  action={
                    <Button size="sm" onClick={() => openComposer("task")}>
                      <PlusIcon className="size-3.5" />
                      New task
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {focus.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      project={state.projects[task.projectId] ?? null}
                      assignee={task.assigneeId ? state.members[task.assigneeId] ?? null : null}
                      now={now}
                      onOpen={() => openTask(task.id)}
                      onToggle={() =>
                        updateTask(task.id, {
                          status: task.status === "done" ? "todo" : "done",
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <ChartCard
            eyebrow="Delivery rhythm"
            title="Work completed, week by week"
            description="Completed tasks against everything created in the last eight weeks."
            action={
              <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-chart-1" />
                  Completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-px w-3 border-t border-dashed border-chart-6" />
                  Created
                </span>
              </span>
            }
          >
            <ChartContainer config={completionConfig} className="h-[196px] w-full">
              <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="dashboard-completed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  width={36}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--color-completed)"
                  fill="url(#dashboard-completed)"
                  strokeWidth={1.75}
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="var(--color-created)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>

          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Portfolio</p>
              <CardTitle>Project health</CardTitle>
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/projects">
                    All projects
                    <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {portfolio.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-muted-foreground">
                  No active projects yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {portfolio.map(({ project, stats }) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="group flex items-center gap-3 py-3 transition-colors hover:bg-muted/40"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[12.5px] font-medium">
                              {project.name}
                            </span>
                            <span className="font-mono text-[9.5px] tracking-[0.1em] text-muted-foreground uppercase">
                              {project.key}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-2">
                            <Progress
                              value={stats.completionRate}
                              className="h-1 max-w-40"
                              aria-label={`${project.name} completion`}
                            />
                            <span className="tnum font-mono text-[10px] text-muted-foreground">
                              {stats.completionRate}%
                            </span>
                          </span>
                        </span>
                        <span className="hidden w-24 shrink-0 text-right text-[10.5px] text-muted-foreground sm:block">
                          Due {formatFullDate(project.dueDate)}
                        </span>
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-4">
              <p className="eyebrow mb-2">Agenda</p>
              <CardTitle>Today</CardTitle>
              <p className="text-[12.5px] text-muted-foreground">{format(now, "EEEE d MMMM")}</p>
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button size="icon-xs" variant="outline" aria-label="Schedule event" onClick={() => openComposer("event", { date: now })}>
                  <CalendarPlusIcon className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {todayEvents.length === 0 ? (
                <p className="px-1 py-4 text-[12px] leading-relaxed text-muted-foreground">
                  Nothing scheduled today. A clear day is a good day to finish something.
                </p>
              ) : (
                <ul className="space-y-1">
                  {todayEvents.map((event) => {
                    const meta = EVENT_TYPE_META[event.type];
                    return (
                      <li key={event.id} className="flex gap-3 rounded-lg px-1 py-2">
                        <span className="tnum w-10 shrink-0 pt-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {event.allDay ? "All day" : formatTime(event.start)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">
                            {event.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <StatusPill label={meta.label} tone={meta.tone} />
                            {event.location ? (
                              <span className="truncate text-[10.5px] text-muted-foreground">
                                {event.location}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {upcoming.length > 0 ? (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="eyebrow mb-2">Coming up</p>
                  <ul className="space-y-2">
                    {upcoming.slice(0, 3).map((event) => (
                      <li key={event.id} className="flex items-baseline gap-2.5 text-[11.5px]">
                        <span className="w-10 shrink-0 font-mono text-[9.5px] text-muted-foreground uppercase">
                          {format(parseISO(event.start), "d MMM")}
                        </span>
                        <span className="truncate">{event.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Activity</p>
              <CardTitle>What changed</CardTitle>
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/team">
                    Team
                    <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {overview.activity.length === 0 ? (
                <p className="py-4 text-[12px] text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {overview.activity.slice(0, 6).map((entry) => {
                    const actor = state.members[entry.actorId];
                    return (
                      <li key={entry.id} className="flex items-start gap-2.5">
                        <EntityAvatar
                          name={actor?.name ?? "Unknown"}
                          hue={actor?.avatarHue ?? 264}
                          size="xs"
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {actor?.name ?? "Someone"}
                            </span>{" "}
                            {ACTIVITY_VERB[entry.kind]}{" "}
                            {entry.entityType === "task" ? (
                              <button
                                type="button"
                                onClick={() => openTask(entry.entityId)}
                                className={cn(
                                  "text-left font-medium text-foreground underline-offset-2 hover:underline",
                                  !state.tasks[entry.entityId] && "pointer-events-none",
                                )}
                              >
                                {entry.entityLabel}
                              </button>
                            ) : (
                              <span className="font-medium text-foreground">
                                {entry.entityLabel}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 font-mono text-[9.5px] tracking-[0.06em] text-muted-foreground/70 uppercase">
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

          <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-primary shadow-card">
                <SparklesIcon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium">Local demo workspace</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Everything here is simulated and saved in this browser. Create, edit and
                  drag real records — nothing leaves this device.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="ghost" size="xs" asChild>
                    <Link href="/settings">Manage data</Link>
                  </Button>
                  <Button variant="ghost" size="xs" asChild>
                    <Link href="/styleguide">Design system</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
        <FolderKanbanIcon className="size-3" aria-hidden="true" />
        {overview.projects.length} projects · {overview.tasks.length} tasks ·{" "}
        {overview.members.length} members · {overview.events.length} events
      </p>
    </div>
  );
}
