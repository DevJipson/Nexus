import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowUpRightIcon, CalendarIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusPill, PriorityIndicator } from "@/components/shared/status-pill";
import { AvatarStack } from "@/components/shared/entity-avatar";
import { PROJECT_STATUS_META } from "@/lib/domain-meta";
import { formatFullDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskStats } from "@/lib/selectors";
import type { Member, Project } from "@/types/domain";

type ProjectWithStats = {
  project: Project;
  stats: TaskStats;
  members: Member[];
  now: Date;
};

export function ProjectCard({ project, stats, members, now }: ProjectWithStats) {
  const meta = PROJECT_STATUS_META[project.status];
  const due = parseISO(project.dueDate);
  const overdue = project.status !== "completed" && due.getTime() < now.getTime();

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-pop focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue} / 0.55)` }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
          />
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            {project.key}
          </span>
        </span>
        <StatusPill label={meta.label} tone={meta.tone} />
      </div>

      <h3 className="mt-3 text-[14px] leading-snug font-medium tracking-[-0.01em]">
        {project.name}
      </h3>
      <p className="mt-1.5 line-clamp-2 min-h-8 text-[11.5px] leading-relaxed text-muted-foreground">
        {project.description || "No brief yet."}
      </p>

      <div className="mt-3.5">
        <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
          <span>
            {stats.done}/{stats.total} {stats.total === 1 ? "task" : "tasks"}
          </span>
          <span className="tnum font-mono">{stats.completionRate}%</span>
        </div>
        <Progress
          value={stats.completionRate}
          className="mt-1.5 h-1"
          aria-label={`${project.name} completion`}
        />
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <AvatarStack people={members} max={4} size="xs" />
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10.5px]",
            overdue ? "font-medium text-danger" : "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-3" aria-hidden="true" />
          {format(due, "d MMM")}
          {overdue ? " · overdue" : ""}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80">
        <PriorityIndicator priority={project.priority} withLabel />
        <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <ArrowUpRightIcon className="size-3" aria-hidden="true" />
        </span>
      </div>

      <span className="sr-only">
        {pluralize(stats.overdue, "overdue task")}. Due {formatFullDate(project.dueDate)}.
      </span>
    </Link>
  );
}
