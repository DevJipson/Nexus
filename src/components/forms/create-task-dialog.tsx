"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { PRIORITY_META, TASK_LABEL_META, TASK_STATUS_META } from "@/lib/domain-meta";
import { workspaceMembers, workspaceProjects } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useTaskPanelStore } from "@/store/task-panel-store";
import { useDataSource } from "@/lib/use-data-source";
import type { Priority, TaskLabel, TaskStatus } from "@/types/domain";

const schema = z.object({
  projectId: z.string().min(1, "Choose a project."),
  title: z.string().trim().min(2, "Describe the task in a few words."),
  description: z.string().trim().max(600, "Keep the detail under 600 characters."),
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigneeId: z.string(),
  dueDate: z.string(),
  labels: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "urgent"];
const LABEL_OPTIONS = Object.keys(TASK_LABEL_META) as TaskLabel[];

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultProjectId,
  defaultStatus = "todo",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string | null;
  defaultStatus?: TaskStatus;
}) {
  const ds = useDataSource();
  const projects = ds.workspaceProjects(ds.activeWorkspaceId ?? "").filter(
    (project) => project.status !== "archived",
  );
  const members = ds.workspaceMembers(ds.activeWorkspaceId ?? "");

  const buildDefaults = (): Values => {
    const preferred =
      defaultProjectId && projects.some((project) => project.id === defaultProjectId)
        ? defaultProjectId
        : (projects.find((project) => project.status === "active")?.id ?? projects[0]?.id ?? "");

    return {
      projectId: preferred,
      title: "",
      description: "",
      status: defaultStatus,
      priority: "medium",
      assigneeId: ds.currentUserId ?? "",
      dueDate: "",
      labels: [],
    };
  };

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) form.reset(buildDefaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProjectId, defaultStatus]);

  const onSubmit = (values: Values) => {
    void ds.createTask({
      projectId: values.projectId,
      title: values.title,
      description: values.description,
      status: values.status,
      priority: values.priority,
      assigneeId: values.assigneeId === "unassigned" ? null : values.assigneeId,
      dueDate: values.dueDate ? new Date(`${values.dueDate}T17:00:00`).toISOString() : null,
      labels: values.labels as TaskLabel[],
    }).then((task) => {
      onOpenChange(false);
      toast.success("Task created", { description: task.title });
      useTaskPanelStore.getState().open(task.id);
    });
  };

  const selectedLabels = form.watch("labels");

  const toggleLabel = (label: TaskLabel) => {
    const next = selectedLabels.includes(label)
      ? selectedLabels.filter((item) => item !== label)
      : [...selectedLabels, label];
    form.setValue("labels", next, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow mb-1">New task</p>
          <DialogTitle>Capture the next action.</DialogTitle>
          <DialogDescription>
            One clear outcome. Add detail once it is on the board.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Project" error={form.formState.errors.projectId?.message}>
            <Controller
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-label="Project">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-primary"
                          style={{ backgroundColor: `oklch(0.6 0.14 ${project.colorHue})` }}
                        />
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField label="Task" htmlFor="task-title" error={form.formState.errors.title?.message}>
            <Input
              id="task-title"
              placeholder="Implement the shell primitives"
              autoFocus
              {...form.register("title")}
            />
          </FormField>

          <FormField
            label="Detail"
            htmlFor="task-detail"
            hint="Optional"
            error={form.formState.errors.description?.message}
          >
            <Textarea
              id="task-detail"
              rows={3}
              placeholder="What does done look like?"
              {...form.register("description")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="Task status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {TASK_STATUS_META[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Priority">
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="Task priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_META[priority].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Assignee">
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="Task assignee">
                      <SelectValue />
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
                )}
              />
            </FormField>

            <FormField label="Due date" htmlFor="task-due" hint="Optional">
              <Input id="task-due" type="date" {...form.register("dueDate")} />
            </FormField>
          </div>

          <FormField label="Labels" hint="Optional">
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((label) => {
                const active = selectedLabels.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleLabel(label)}
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/80 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: `oklch(0.62 0.13 ${TASK_LABEL_META[label].hue})`,
                      }}
                    />
                    {TASK_LABEL_META[label].label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
