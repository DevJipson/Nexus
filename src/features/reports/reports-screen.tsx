"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  FlameIcon,
  GaugeIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { ChartCard } from "@/components/shared/chart-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_META } from "@/lib/domain-meta";
import { formatFullDate } from "@/lib/format";
import {
  averageCycleTimeDays,
  completionRateTrend,
  completionSeries,
  prioritySeries,
  projectStats,
  statusSeries,
  workspaceMembers,
  workspaceOverview,
  workspaceProjects,
  workspaceTasks,
  workloadSeries,
} from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const throughputConfig = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  created: { label: "Created", color: "var(--chart-6)" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "Tasks", color: "var(--chart-1)" },
} satisfies ChartConfig;

const priorityConfig = {
  count: { label: "Open tasks", color: "var(--chart-3)" },
} satisfies ChartConfig;

const workloadConfig = {
  open: { label: "Open", color: "var(--chart-1)" },
  overdue: { label: "Overdue", color: "var(--danger)" },
} satisfies ChartConfig;

const STATUS_FILL: Record<string, string> = {
  backlog: "var(--chart-6)",
  todo: "var(--info)",
  in_progress: "var(--warning)",
  in_review: "var(--chart-1)",
  done: "var(--success)",
};

export function ReportsScreen() {
  const state = useWorkspaceStore();
  const now = new Date();
  const workspace = state.workspaces[state.activeWorkspaceId];
  const overview = workspaceOverview(state, state.activeWorkspaceId, now);
  const members = workspaceMembers(state, state.activeWorkspaceId);
  const tasks = workspaceTasks(state, state.activeWorkspaceId);
  const projects = workspaceProjects(state, state.activeWorkspaceId);

  const series = completionSeries(tasks, 8, now);
  const status = statusSeries(tasks);
  const priority = prioritySeries(tasks);
  const workload = workloadSeries(tasks, members, now);
  const cycleTime = averageCycleTimeDays(tasks);
  const trend = completionRateTrend(tasks, now);
  const completedThisWeek = series[series.length - 1]?.completed ?? 0;

  const projectRows = projects
    .map((project) => ({ project, stats: projectStats(state, project.id, now) }))
    .sort((a, b) => a.project.dueDate.localeCompare(b.project.dueDate));

  const TrendIcon = trend >= 0 ? TrendingUpIcon : TrendingDownIcon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Evidence, not guesswork."
        description="Every number on this page is computed live from the same task and project records you see elsewhere — nothing is hardcoded or simulated separately."
        meta={
          <span className="text-[11.5px] text-muted-foreground">
            {workspace?.name} · trailing 8 weeks · {tasks.length} tasks sampled
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Completion rate"
          value={`${overview.stats.completionRate}%`}
          detail={`${overview.stats.done} of ${overview.stats.total} tasks done`}
          icon={GaugeIcon}
          tone="accent"
        />
        <StatTile
          label="Avg cycle time"
          value={cycleTime === 0 ? "—" : `${cycleTime}d`}
          detail="Created → done, completed tasks only"
          icon={TimerIcon}
        />
        <StatTile
          label="Done this week"
          value={String(completedThisWeek)}
          detail={
            <span className="inline-flex items-center gap-1">
              <TrendIcon
                className={cn("size-3", trend >= 0 ? "text-success" : "text-danger")}
                aria-hidden="true"
              />
              {trend >= 0 ? "+" : ""}
              {trend}% vs last week
            </span>
          }
          icon={CheckCircle2Icon}
          tone="positive"
        />
        <StatTile
          label="Overdue now"
          value={String(overview.stats.overdue)}
          detail={overview.stats.overdue > 0 ? "Needs triage" : "Nothing has slipped"}
          icon={FlameIcon}
          tone={overview.stats.overdue > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          eyebrow="Throughput"
          title="Completed vs created"
          description="Eight trailing weeks. A widening gap means the backlog is shrinking."
          className="xl:col-span-2"
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
          <ChartContainer config={throughputConfig} className="h-[240px] w-full">
            <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="reports-completed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="var(--color-completed)"
                fill="url(#reports-completed)"
                strokeWidth={1.75}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="var(--color-created)"
                strokeDasharray="3 3"
                fill="transparent"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          eyebrow="Where the work sits"
          title="Tasks by status"
          description="All tasks in the workspace, including completed."
        >
          <ChartContainer config={statusConfig} className="h-[240px] w-full">
            <BarChart
              data={status}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid horizontal={false} strokeDasharray="2 4" stroke="var(--border)" />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={86}
                tick={{ fontSize: 10, className: "capitalize" }}
              />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" radius={[3, 3, 3, 3]} maxBarSize={18}>
                {status.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_FILL[entry.status] ?? "var(--chart-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          eyebrow="What risks waiting"
          title="Open work by priority"
          description="Urgent and high priority items that are not done yet."
        >
          <ChartContainer config={priorityConfig} className="h-[220px] w-full">
            <BarChart data={priority} margin={{ top: 4, right: 4, bottom: 0, left: -22 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 2, 2]} maxBarSize={44} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          eyebrow="Load balance"
          title="Open work by owner"
          description="Overdue work stacks on top of open assignments."
          className="xl:col-span-2"
          action={
            <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[3px] bg-chart-1" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[3px] bg-danger" />
                Overdue
              </span>
            </span>
          }
        >
          <ChartContainer config={workloadConfig} className="h-[220px] w-full">
            <BarChart
              data={workload}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              stackOffset="none"
              barCategoryGap="18%"
            >
              <CartesianGrid horizontal={false} strokeDasharray="2 4" stroke="var(--border)" />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={92}
                tickFormatter={(value: string) => value.split(" ")[0]}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent />} />
              <Bar dataKey="open" stackId="load" fill="var(--color-open)" radius={[2, 0, 0, 2]} maxBarSize={16} />
              <Bar dataKey="overdue" stackId="load" fill="var(--color-overdue)" radius={[0, 3, 3, 0]} maxBarSize={16} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3.5">
          <div>
            <p className="eyebrow mb-1.5">Delivery detail</p>
            <h2 className="text-[13.5px] font-medium">Project health</h2>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Portfolio view
            <ArrowUpRightIcon className="size-3" aria-hidden="true" />
          </Link>
        </header>
        {projectRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            No projects in this workspace yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {projectRows.map(({ project, stats }) => {
              const meta = PROJECT_STATUS_META[project.status];
              const done = stats.total > 0 && stats.done === stats.total;
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="group grid grid-cols-[minmax(0,1.4fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium group-hover:text-primary">
                          {project.name}
                        </span>
                        <span className="block font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
                          {project.key} · due {formatFullDate(project.dueDate)}
                        </span>
                      </span>
                    </span>
                    <StatusPill label={meta.label} tone={meta.tone} className="justify-self-end" />
                    <span className="hidden items-center gap-2 sm:flex">
                      <Progress value={stats.completionRate} className="h-1.5 w-28" aria-label={`${project.name} completion`} />
                      <span className="tnum font-mono text-[10px] text-muted-foreground">
                        {stats.completionRate}%
                      </span>
                    </span>
                    <span className="tnum hidden font-mono text-[10.5px] text-muted-foreground sm:block">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2Icon className="size-3" aria-hidden="true" />
                          done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <CircleDashedIcon className="size-3" aria-hidden="true" />
                          {stats.open} open
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
        <TimerIcon className="size-3" aria-hidden="true" />
        Derived from {tasks.length} tasks · {projects.length} projects · updated {format(now, "HH:mm")}
      </p>
    </div>
  );
}
