"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { MemberPicker } from "@/components/forms/member-picker";
import { EVENT_TYPE_META } from "@/lib/domain-meta";
import { useDataSource } from "@/lib/use-data-source";
import type { CalendarEvent, CalendarEventType } from "@/types/domain";

const EVENT_TYPES: CalendarEventType[] = ["meeting", "deadline", "milestone", "focus"];

const schema = z
  .object({
    title: z.string().trim().min(2, "Name the event."),
    description: z.string().trim().max(320, "Keep the note under 320 characters."),
    type: z.enum(["meeting", "deadline", "milestone", "focus"]),
    projectId: z.string(),
    date: z.string().min(1, "Choose a date."),
    allDay: z.boolean(),
    startTime: z.string().min(1, "Add a start time."),
    endTime: z.string().min(1, "Add an end time."),
    location: z.string().trim().max(80),
    attendeeIds: z.array(z.string()).min(1, "Invite at least one person."),
  })
  .refine(
    (values) => values.allDay || values.endTime > values.startTime,
    { path: ["endTime"], message: "The end time must be after the start." },
  );

type Values = z.infer<typeof schema>;

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  event?: CalendarEvent;
}) {
  const ds = useDataSource();
  const members = ds.workspaceMembers(ds.activeWorkspaceId ?? "");
  const projects = ds.workspaceProjects(ds.activeWorkspaceId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = Boolean(event);

  const buildDefaults = (): Values => {
    if (event) {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      return {
        title: event.title,
        description: event.description,
        type: event.type,
        projectId: event.projectId ?? "none",
        date: format(start, "yyyy-MM-dd"),
        allDay: event.allDay,
        startTime: event.allDay ? "10:00" : format(start, "HH:mm"),
        endTime: event.allDay ? "23:59" : format(end, "HH:mm"),
        location: event.location,
        attendeeIds: event.attendeeIds,
      };
    }
    return {
      title: "",
      description: "",
      type: "meeting",
      projectId: "none",
      date: format(defaultDate ?? new Date(), "yyyy-MM-dd"),
      allDay: false,
      startTime: "10:00",
      endTime: "11:00",
      location: "",
      attendeeIds: [ds.currentUserId ?? ""],
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
  }, [open, defaultDate, event]);

  const allDay = form.watch("allDay");
  const attendeeIds = form.watch("attendeeIds");

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const start = values.allDay
        ? new Date(`${values.date}T00:00:00`)
        : new Date(`${values.date}T${values.startTime}:00`);
      const end = values.allDay
        ? new Date(`${values.date}T23:59:00`)
        : new Date(`${values.date}T${values.endTime}:00`);

      if (isEditing && event) {
        await ds.updateEvent(event.id, {
          title: values.title,
          description: values.description,
          type: values.type,
          projectId: values.projectId === "none" ? null : values.projectId,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: values.allDay,
          attendeeIds: values.attendeeIds,
          location: values.location,
        });
        toast.success("Event updated", {
          description: `${values.title} · ${format(start, "d MMM")}`,
        });
      } else {
        await ds.createEvent({
          title: values.title,
          description: values.description,
          type: values.type,
          projectId: values.projectId === "none" ? null : values.projectId,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: values.allDay,
          attendeeIds: values.attendeeIds,
          location: values.location,
        });
        toast.success("Event scheduled", {
          description: `${values.title} · ${format(start, "d MMM")}`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAttendee = (id: string) => {
    form.setValue(
      "attendeeIds",
      attendeeIds.includes(id)
        ? attendeeIds.filter((item) => item !== id)
        : [...attendeeIds, id],
      { shouldValidate: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow mb-1">{isEditing ? "Edit event" : "New event"}</p>
          <DialogTitle>{isEditing ? "Modify the time block." : "Block the time."}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Changes are saved to the server."
              : "Meetings, deadlines, milestones and focus blocks share one calendar language."}
          </DialogDescription>
        </DialogHeader>

        {submitError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-[11px] text-destructive">
            {submitError}
          </div>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Title" htmlFor="event-title" error={form.formState.errors.title?.message}>
            <Input
              id="event-title"
              placeholder="Meridian launch review"
              autoFocus
              {...form.register("title")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label="Event type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {EVENT_TYPE_META[type].label}
                        </SelectItem>
                      ))}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Date" htmlFor="event-date" error={form.formState.errors.date?.message}>
              <Input id="event-date" type="date" {...form.register("date")} />
            </FormField>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2.5 text-[12px]">
                <Controller
                  control={form.control}
                  name="allDay"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                All day
              </label>
            </div>
          </div>

          {allDay ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Starts" htmlFor="event-start" error={form.formState.errors.startTime?.message}>
                <Input id="event-start" type="time" {...form.register("startTime")} />
              </FormField>
              <FormField label="Ends" htmlFor="event-end" error={form.formState.errors.endTime?.message}>
                <Input id="event-end" type="time" {...form.register("endTime")} />
              </FormField>
            </div>
          )}

          <FormField label="Location" htmlFor="event-location" hint="Optional">
            <Input id="event-location" placeholder="Studio room · Zoom" {...form.register("location")} />
          </FormField>

          <FormField label="Note" htmlFor="event-note" hint="Optional">
            <Textarea
              id="event-note"
              rows={2}
              placeholder="What needs to happen?"
              {...form.register("description")}
            />
          </FormField>

          <FormField
            label="Attendees"
            hint={`${attendeeIds.length} invited`}
            error={form.formState.errors.attendeeIds?.message}
          >
            <MemberPicker
              members={members}
              selected={attendeeIds}
              onToggle={toggleAttendee}
              label="Event attendees"
              maxHeight="max-h-40"
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={submitting}
            >
              {isEditing ? "Update event" : "Schedule event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
