"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format } from "date-fns";
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
import { MemberPicker } from "@/components/forms/member-picker";
import { PROJECT_STATUS_META, PRIORITY_META } from "@/lib/domain-meta";
import { useDataSource } from "@/lib/use-data-source";
import type { Priority, ProjectStatus } from "@/types/domain";

const schema = z.object({
  name: z.string().trim().min(2, "Give the project a name."),
  description: z.string().trim().max(320, "Keep the brief under 320 characters."),
  status: z.enum(["planning", "active", "on_hold", "completed", "archived"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().min(1, "Choose a due date."),
  memberIds: z.array(z.string()).min(1, "Select at least one person."),
});

type Values = z.infer<typeof schema>;

const STATUS_OPTIONS: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
];

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "urgent"];

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const ds = useDataSource();
  const members = ds.workspaceMembers(ds.activeWorkspaceId ?? "");

  const defaults: Values = {
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    memberIds: [ds.currentUserId ?? ""],
  };

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = (values: Values) => {
    void ds.createProject({
      name: values.name,
      description: values.description,
      status: values.status,
      priority: values.priority,
      dueDate: new Date(`${values.dueDate}T17:00:00`).toISOString(),
      memberIds: values.memberIds,
    }).then((project) => {
      onOpenChange(false);
      toast.success("Project created", { description: project.name });
      router.push(`/projects/${project.id}`);
    });
  };

  const toggleMember = (id: string) => {
    const current = form.getValues("memberIds");
    form.setValue(
      "memberIds",
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      { shouldValidate: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow mb-1">New project</p>
          <DialogTitle>Give the work a shape.</DialogTitle>
          <DialogDescription>
            A name, an owner and a date are enough to start. Everything else can change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Project name" htmlFor="project-name" error={form.formState.errors.name?.message}>
            <Input
              id="project-name"
              placeholder="Atlas design language"
              autoFocus
              {...form.register("name")}
            />
          </FormField>

          <FormField
            label="Brief"
            htmlFor="project-brief"
            hint="Optional"
            error={form.formState.errors.description?.message}
          >
            <Textarea
              id="project-brief"
              rows={3}
              placeholder="What are we making, and why now?"
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
                    <SelectTrigger className="w-full" aria-label="Project status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {PROJECT_STATUS_META[status].label}
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
                    <SelectTrigger className="w-full" aria-label="Project priority">
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
          </div>

          <FormField label="Due date" htmlFor="project-due" error={form.formState.errors.dueDate?.message}>
            <Input id="project-due" type="date" {...form.register("dueDate")} />
          </FormField>

          <FormField
            label="Team"
            hint={`${form.watch("memberIds").length} selected`}
            error={form.formState.errors.memberIds?.message}
          >
            <MemberPicker
              members={members}
              selected={form.watch("memberIds")}
              onToggle={toggleMember}
              label="Project team"
              maxHeight="max-h-44"
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
