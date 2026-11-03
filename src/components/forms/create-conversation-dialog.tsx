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
import { MemberPicker } from "@/components/forms/member-picker";
import { workspaceMembers, workspaceProjects } from "@/lib/selectors";
import { useWorkspaceStore } from "@/store/workspace-store";

const schema = z
  .object({
    kind: z.enum(["direct", "group"]),
    name: z.string().trim().max(80),
    participantIds: z.array(z.string()).min(1, "Choose at least one person."),
    projectId: z.string(),
    firstMessage: z.string().trim().max(1000),
  })
  .refine((values) => values.kind !== "group" || values.name.length >= 2, {
    path: ["name"],
    message: "Give the group a name.",
  })
  .refine((values) => values.kind !== "direct" || values.participantIds.length === 1, {
    path: ["participantIds"],
    message: "A direct message needs exactly one person.",
  });

type Values = z.infer<typeof schema>;

export function CreateConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversationId: string) => void;
}) {
  const state = useWorkspaceStore();
  const members = workspaceMembers(state, state.activeWorkspaceId).filter(
    (member) => member.id !== state.currentUserId,
  );
  const projects = workspaceProjects(state, state.activeWorkspaceId);

  const buildDefaults = (): Values => ({
    kind: "group",
    name: "",
    participantIds: [],
    projectId: "none",
    firstMessage: "",
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) form.reset(buildDefaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const kind = form.watch("kind");
  const participantIds = form.watch("participantIds");

  const onSubmit = (values: Values) => {
    const conversation = state.createConversation({
      kind: values.kind,
      name: values.kind === "group" ? values.name : null,
      participantIds: values.participantIds,
      projectId: values.projectId === "none" ? null : values.projectId,
      firstMessage: values.firstMessage,
    });

    onOpenChange(false);
    toast.success("Conversation started");
    onCreated?.(conversation.id);
  };

  const toggleParticipant = (id: string) => {
    const next =
      kind === "direct"
        ? [id]
        : participantIds.includes(id)
          ? participantIds.filter((item) => item !== id)
          : [...participantIds, id];
    form.setValue("participantIds", next, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="eyebrow mb-1">New conversation</p>
          <DialogTitle>Start with context.</DialogTitle>
          <DialogDescription>
            Direct threads and project conversations stay attached to the work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Kind">
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("participantIds", [], { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label="Conversation kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">Group thread</SelectItem>
                      <SelectItem value="direct">Direct message</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Project" hint="Optional">
              <Controller
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="Project">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          {kind === "group" ? (
            <FormField label="Name" htmlFor="conversation-name" error={form.formState.errors.name?.message}>
              <Input
                id="conversation-name"
                placeholder="Meridian launch"
                autoFocus
                {...form.register("name")}
              />
            </FormField>
          ) : null}

          <FormField
            label={kind === "direct" ? "Person" : "People"}
            hint={`${participantIds.length} selected`}
            error={form.formState.errors.participantIds?.message}
          >
            <MemberPicker
              members={members}
              selected={participantIds}
              onToggle={toggleParticipant}
              label="Conversation participants"
              maxHeight="max-h-44"
            />
          </FormField>

          <FormField label="First message" htmlFor="conversation-message" hint="Optional">
            <Textarea
              id="conversation-message"
              rows={3}
              placeholder="What is this thread for?"
              {...form.register("firstMessage")}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting}>
              Start conversation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
