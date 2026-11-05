"use client";

import { useEffect, useState } from "react";
import {
  Columns3Icon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  TableIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TaskRow } from "@/components/shared/task-row";
import { TaskBoard } from "@/features/tasks/task-board";
import { TaskTable } from "@/features/tasks/task-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  TASK_LABELS,
  TASK_LABEL_META,
} from "@/lib/domain-meta";
import {
  filterTasks,
  groupTasksByStatus,
  rankTasks,
  workspaceMembers,
  workspaceProjects,
  workspaceTasks,
} from "@/lib/selectors";
import { useDataSource, useDataSourceSelectors } from "@/lib/use-data-source";
import { useComposeStore } from "@/store/compose-store";
import { useTaskPanelStore } from "@/store/task-panel-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { TaskFilters, TaskLabel, TaskView } from "@/types/domain";

const DEFAULT_FILTERS: TaskFilters = {
  search: "",
  assigneeId: "all",
  priority: "all",
  projectId: "all",
  label: "all",
};

export function TasksScreen() {
  const ds = useDataSource();
  const { filterTasks, groupTasksByStatus, rankTasks: computeRankTasks } = useDataSourceSelectors();
  const state = useWorkspaceStore();
  const openComposer = useComposeStore((store) => store.open);
  const openTask = useTaskPanelStore((store) => store.open);

  const [view, setView] = useState<TaskView>("board");
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);

  const now = new Date();
  const workspaceId = ds.activeWorkspaceId;
  const members = ds.workspaceMembers(workspaceId ?? "");
  const projects = ds.workspaceProjects(workspaceId ?? "");
  const tasks = ds.workspaceTasks(workspaceId ?? "");

  // Bootstrap data from the backend when in live mode.
  useEffect(() => {
    if (ds.mode !== "live" || !workspaceId) return;
    void ds.bootstrap(workspaceId);
  }, [ds.mode, workspaceId, ds.bootstrap]);

  const mineOnly = filters.assigneeId === state.currentUserId;
  const filtered = filterTasks(tasks, filters);
  const filterActive =
    filters.search !== "" ||
    filters.assigneeId !== "all" ||
    filters.priority !== "all" ||
    filters.projectId !== "all" ||
    filters.label !== "all";

  const grouped = groupTasksByStatus(filtered);
  const ranked = computeRankTasks(filtered, now);

  const setFilter = <Key extends keyof TaskFilters>(key: Key, value: TaskFilters[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleMine = () =>
    setFilters((current) => ({
      ...current,
      assigneeId: mineOnly ? "all" : state.currentUserId,
    }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const openCount = tasks.filter((task) => task.status !== "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Everything on the board."
        description="Every task in this workspace, from backlog to done — drag between columns, filter by owner, or drop into the table for bulk scanning."
        actions={
          <>
            <Button
              variant={mineOnly ? "default" : "outline"}
              onClick={toggleMine}
              aria-pressed={mineOnly}
            >
              <UserRoundIcon className="size-4" />
              Assigned to me
            </Button>
            <Button onClick={() => openComposer("task")}>
              <PlusIcon className="size-4" />
              New task
            </Button>
          </>
        }
        meta={
          <>
            <span className="text-[11.5px] text-muted-foreground">
              {filtered.length} of {tasks.length} tasks
            </span>
            <span aria-hidden="true" className="text-muted-foreground/40">
              ·
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {openCount} open across {projects.length} projects
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/50 p-2.5 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Search tasks, labels or descriptions…"
            aria-label="Search tasks"
            className="h-8 bg-card pl-8 text-[12.5px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.assigneeId}
            onValueChange={(value) => setFilter("assigneeId", value)}
          >
            <SelectTrigger size="sm" aria-label="Filter by assignee" className="w-[136px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value={state.currentUserId}>Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members
                .filter((member) => member.id !== state.currentUserId)
                .map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) =>
              setFilter("priority", value as TaskFilters["priority"])
            }
          >
            <SelectTrigger size="sm" aria-label="Filter by priority" className="w-[124px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_ORDER.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {PRIORITY_META[priority].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.projectId}
            onValueChange={(value) => setFilter("projectId", value)}
          >
            <SelectTrigger size="sm" aria-label="Filter by project" className="w-[150px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.label}
            onValueChange={(value) => setFilter("label", value as TaskLabel | "all")}
          >
            <SelectTrigger size="sm" aria-label="Filter by label" className="w-[120px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {TASK_LABELS.map((label) => (
                <SelectItem key={label} value={label}>
                  {TASK_LABEL_META[label].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filterActive ? (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <XIcon className="size-3.5" />
              Clear
            </Button>
          ) : null}

          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as TaskView)}
            aria-label="Task view"
            className="ml-auto"
          >
            <ToggleGroupItem value="board" aria-label="Board view" className="size-8">
              <Columns3Icon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="size-8">
              <ListIcon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" className="size-8">
              <TableIcon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="No tasks match"
          description="Try a different search, or clear the owner, priority, project and label filters."
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : view === "board" ? (
        <TaskBoard grouped={grouped} now={now} />
      ) : view === "list" ? (
        <Card className="gap-0 py-2">
          <CardContent className="px-2 pt-0 pb-0">
            <ul className="divide-y divide-border/50">
              {ranked.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={ds.projects[task.projectId] ?? null}
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
          </CardContent>
        </Card>
      ) : (
        <TaskTable tasks={[...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} members={members} now={now} />
      )}

      <p
        aria-hidden="true"
        className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase"
      >
        {view === "board"
          ? "Drag between columns — status updates are saved locally"
          : view === "list"
            ? "Ranked by overdue, then priority and due date"
            : "Inline status, priority and assignee editing"}
      </p>
    </div>
  );
}
