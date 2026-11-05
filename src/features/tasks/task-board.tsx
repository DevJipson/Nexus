"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { format, isTomorrow, parseISO } from "date-fns";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquareIcon, MessageSquareIcon, PlusIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PriorityIndicator } from "@/components/shared/status-pill";
import { isTaskDueToday, isTaskOverdue } from "@/lib/selectors";
import { TASK_STATUS_META, TASK_STATUS_ORDER, toneVar } from "@/lib/domain-meta";
import { cn } from "@/lib/utils";
import { useDataSource } from "@/lib/use-data-source";
import { useComposeStore } from "@/store/compose-store";
import { useTaskPanelStore } from "@/store/task-panel-store";
import type { Task, TaskStatus } from "@/types/domain";

export function TaskBoard({
  grouped,
  now,
}: {
  grouped: Record<TaskStatus, Task[]>;
  now: Date;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ds = useDataSource();
  const moveTask = (id: string, status: any, index?: number) => void ds.moveTask(id, status, index);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = activeId
    ? Object.values(grouped).flat().find((task) => task.id === activeId) ?? null
    : null;

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const overIsColumn = TASK_STATUS_ORDER.includes(overId as TaskStatus);
    const targetStatus: TaskStatus = overIsColumn
      ? (overId as TaskStatus)
      : (Object.values(grouped)
          .flat()
          .find((task) => task.id === overId)?.status ?? "backlog");

    const targetTasks = grouped[targetStatus].filter((task) => task.id !== activeId);

    let index = targetTasks.length;
    if (!overIsColumn) {
      const overIndex = targetTasks.findIndex((task) => task.id === overId);
      index = overIndex === -1 ? targetTasks.length : overIndex;
    }

    moveTask(activeId, targetStatus, index);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {TASK_STATUS_ORDER.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            now={now}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCardContent task={activeTask} now={now} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  tasks,
  now,
}: {
  status: TaskStatus;
  tasks: Task[];
  now: Date;
}) {
  const meta = TASK_STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const openComposer = useComposeStore((state) => state.open);

  return (
    <section
      aria-label={`${meta.label} column, ${tasks.length} tasks`}
      className={cn(
        "flex w-[272px] shrink-0 flex-col rounded-xl border border-border/70 bg-surface/60 transition-colors",
        isOver && "border-primary/35 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: toneVar(meta.tone) }}
        />
        <h2 className="text-[11.5px] font-medium tracking-[-0.005em]">{meta.label}</h2>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {tasks.length}
        </span>
        <button
          type="button"
          aria-label={`Add task to ${meta.label}`}
          onClick={() => openComposer("task")}
          className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </header>

      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2.5">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 py-6">
              <p className="text-[10.5px] text-muted-foreground/80">Drop here</p>
            </div>
          ) : (
            tasks.map((task) => <BoardCard key={task.id} task={task} now={now} />)
          )}
        </SortableContext>
      </div>
    </section>
  );
}

function BoardCard({ task, now }: { task: Task; now: Date }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${task.title}. Drag to reorder.`}
      className={cn(
        "cursor-grab touch-none rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TaskCardContent task={task} now={now} />
    </div>
  );
}

function TaskCardContent({
  task,
  now,
  overlay = false,
}: {
  task: any;
  now: Date;
  overlay?: boolean;
}) {
  const ds = useDataSource();
  const openTask = useTaskPanelStore((store) => store.open);
  const project = ds.projects[task.projectId];
  const assignee = task.assigneeId ? ds.members[task.assigneeId] : null;
  const subtasksDone = task.subtasks.filter((item: any) => item.done).length;
  const overdue = isTaskOverdue(task, now);
  const dueToday = isTaskDueToday(task, now);

  const due = task.dueDate ? parseISO(task.dueDate) : null;
  const dueLabel = due
    ? isTomorrow(due)
      ? "Tomorrow"
      : dueToday
        ? "Today"
        : format(due, "d MMM")
    : null;

  return (
    <article
      className={cn(
        "rounded-lg border border-border/80 bg-card p-2.5 shadow-card transition-shadow",
        overlay && "rotate-[0.6deg] border-primary/30 shadow-pop",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ backgroundColor: `oklch(0.62 0.14 ${project?.colorHue ?? 264})` }}
          />
          <span className="truncate">{project?.key ?? "Task"}</span>
        </span>
        <PriorityIndicator priority={task.priority} />
      </div>

      <button
        type="button"
        onClick={() => openTask(task.id)}
        onPointerDown={(event) => event.stopPropagation()}
        className="mt-1.5 block w-full text-left outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        <span
          className={cn(
            "line-clamp-2 text-[12px] leading-snug font-medium tracking-[-0.005em]",
            task.status === "done" && "text-muted-foreground",
          )}
        >
          {task.title}
        </span>
      </button>

      <div className="mt-2 flex items-center gap-1.5">
        {due ? (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md border border-border/60 bg-surface px-1.5 font-mono text-[9.5px]",
              overdue
                ? "border-danger/25 bg-danger/10 text-danger"
                : dueToday
                  ? "border-warning/25 bg-warning/10 text-warning"
                  : "text-muted-foreground",
            )}
          >
            {dueLabel}
          </span>
        ) : null}
        {task.subtasks.length > 0 ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-md font-mono text-[9.5px] text-muted-foreground">
            <CheckSquareIcon className="size-3" aria-hidden="true" />
            {subtasksDone}/{task.subtasks.length}
          </span>
        ) : null}
        {task.comments.length > 0 ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-md font-mono text-[9.5px] text-muted-foreground">
            <MessageSquareIcon className="size-3" aria-hidden="true" />
            {task.comments.length}
          </span>
        ) : null}
        <span className="ml-auto">
          {assignee ? (
            <EntityAvatar name={assignee.name} hue={assignee.avatarHue} size="xs" />
          ) : (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full border border-dashed border-border text-[8px] text-muted-foreground"
              title="Unassigned"
            >
              ?
            </span>
          )}
        </span>
        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={() =>
            void ds.updateTask(task.id, {
              status: task.status === "done" ? "todo" : "done",
            })
          }
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={task.status === "done" ? "Reopen task" : "Complete task"}
          className="size-3.5"
        />
      </div>
    </article>
  );
}
