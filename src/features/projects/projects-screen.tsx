"use client";

import { useState } from "react";
import {
  FolderKanbanIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectCard } from "@/features/projects/project-card";
import { StatusPill, PriorityIndicator } from "@/components/shared/status-pill";
import { AvatarStack } from "@/components/shared/entity-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { PROJECT_STATUS_META, PRIORITY_META } from "@/lib/domain-meta";
import { pluralize } from "@/lib/format";
import {
  projectStats,
  sortProjects,
  workspaceMembers,
  workspaceProjects,
} from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useComposeStore } from "@/store/compose-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Priority, ProjectStatus } from "@/types/domain";

type StatusFilter = ProjectStatus | "all";
type PriorityFilter = Priority | "all";
type SortKey = "updated" | "due" | "name" | "progress";
type View = "grid" | "list";

const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
];

const PRIORITY_OPTIONS: PriorityFilter[] = ["all", "urgent", "high", "medium", "low"];

const SORT_LABEL: Record<SortKey, string> = {
  updated: "Recently updated",
  due: "Due soonest",
  name: "Name A–Z",
  progress: "Most complete",
};

export function ProjectsScreen() {
  const state = useWorkspaceStore();
  const now = new Date();
  const openComposer = useComposeStore((state) => state.open);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<View>("grid");

  const allProjects = workspaceProjects(state, state.activeWorkspaceId);
  const members = workspaceMembers(state, state.activeWorkspaceId);

  const needle = search.trim().toLowerCase();
  const filtered = allProjects.filter((project) => {
    if (status !== "all" && project.status !== status) return false;
    if (priority !== "all" && project.priority !== priority) return false;
    if (!needle) return true;
    return [project.name, project.description, project.key]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const sorted = sortProjects(state, filtered, sort);
  const withStats = sorted.map((project) => ({
    project,
    stats: projectStats(state, project.id, now),
    members: project.memberIds
      .map((id) => state.members[id])
      .filter((member): member is NonNullable<typeof member> => Boolean(member)),
    now,
  }));

  const activeCount = allProjects.filter((project) => project.status === "active").length;
  const planningCount = allProjects.filter((project) => project.status === "planning").length;
  const onHoldCount = allProjects.filter((project) => project.status === "on_hold").length;
  const completedCount = allProjects.filter((project) => project.status === "completed").length;

  const filteredActive = filtered.some((project) => project.status === "active");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Projects, in focus."
        description="Portfolio health, ownership and momentum at a glance — then straight into the detail that matters."
        actions={
          <Button onClick={() => openComposer("project")}>
            <PlusIcon className="size-4" />
            New project
          </Button>
        }
        meta={
          <>
            <span className="text-[11.5px] text-muted-foreground">
              {pluralize(allProjects.length, "project")}
            </span>
            <span aria-hidden="true" className="text-muted-foreground/40">
              ·
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {activeCount} active · {planningCount} planning
            </span>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active"
          value={String(activeCount)}
          detail="Work currently moving"
          icon={FolderKanbanIcon}
          tone="accent"
        />
        <StatTile label="Planning" value={String(planningCount)} detail="Shaping the scope" />
        <StatTile
          label="On hold"
          value={String(onHoldCount)}
          detail={onHoldCount > 0 ? "Waiting on a decision" : "Nothing paused"}
        />
        <StatTile
          label="Completed"
          value={String(completedCount)}
          detail="Closed and archived-ready"
          tone="positive"
        />
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface/50 p-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="h-8 bg-card pl-8 text-[12.5px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger size="sm" aria-label="Filter by status" className="w-[124px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "All statuses" : PROJECT_STATUS_META[option].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as PriorityFilter)}
          >
            <SelectTrigger size="sm" aria-label="Filter by priority" className="w-[124px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "All priorities" : PRIORITY_META[option].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger size="sm" aria-label="Sort projects" className="w-[150px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as View)}
            aria-label="Project view"
            className="ml-auto"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" className="size-8">
              <LayoutGridIcon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="size-8">
              <ListIcon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {withStats.length === 0 ? (
        <EmptyState
          icon={search ? SearchXIcon : FolderPlusIcon}
          title={search ? "No projects match" : "No projects here yet"}
          description={
            search
              ? "Try a different search, or widen the status and priority filters."
              : "Create the first project in this workspace and give the work a shape."
          }
          action={
            search ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setPriority("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => openComposer("project")}>
                <PlusIcon className="size-3.5" />
                New project
              </Button>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {withStats.map((item) => (
            <ProjectCard key={item.project.id} {...item} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
          <table className="w-full border-collapse">
            <caption className="sr-only">Projects in {state.workspaces[state.activeWorkspaceId]?.name}</caption>
            <thead>
              <tr className="border-b border-border/70 bg-surface/50 text-left">
                <th scope="col" className="px-4 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
                  Project
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase md:table-cell">
                  Status
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase lg:table-cell">
                  Priority
                </th>
                <th scope="col" className="px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
                  Progress
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase sm:table-cell">
                  Team
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-[10px] font-mono tracking-[0.12em] text-muted-foreground uppercase">
                  Due
                </th>
              </tr>
            </thead>
            <tbody>
              {withStats.map(({ project, stats, members: projectMembers }) => {
                const meta = PROJECT_STATUS_META[project.status];
                return (
                  <tr
                    key={project.id}
                    className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="group block min-w-0">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: `oklch(0.62 0.14 ${project.colorHue})` }}
                          />
                          <span className="truncate text-[12.5px] font-medium group-hover:text-primary">
                            {project.name}
                          </span>
                          <span className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
                            {project.key}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 block pl-3.5 text-[11px] text-muted-foreground">
                          {project.description}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <StatusPill label={meta.label} tone={meta.tone} />
                    </td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <PriorityIndicator priority={project.priority} withLabel />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <Progress
                          value={stats.completionRate}
                          className="h-1 w-16"
                          aria-label={`${project.name} completion`}
                        />
                        <span className="tnum font-mono text-[10px] text-muted-foreground">
                          {stats.completionRate}%
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      <AvatarStack people={projectMembers} max={3} size="xs" />
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right text-[11px] whitespace-nowrap",
                        project.status !== "completed" &&
                          parseISO(project.dueDate).getTime() < now.getTime()
                          ? "font-medium text-danger"
                          : "text-muted-foreground",
                      )}
                    >
                      {format(parseISO(project.dueDate), "d MMM yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredActive ? null : withStats.length > 0 ? (
        <p className="text-[11.5px] text-muted-foreground">
          No active projects in this view. Switch the status filter to see planning or
          completed work.
        </p>
      ) : null}

      <p className="flex items-center gap-2 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
        <FolderKanbanIcon className="size-3" aria-hidden="true" />
        {members.length} members · {allProjects.length} projects · demo data in this browser
      </p>
    </div>
  );
}
