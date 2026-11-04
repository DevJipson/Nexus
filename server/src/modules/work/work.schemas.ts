import { z } from "zod";

/**
 * Validation schemas for Phase 3 (projects, tasks, subtasks, comments,
 * attachments, calendar events).
 *
 * Field rules mirror the frontend create dialogs (react-hook-form + zod) so the
 * API rejects exactly what the UI rejects, plus the server-only invariants
 * (workspace membership, ordering, ISO instant formats).
 */

/* --------------------------------- Enums --------------------------------- */

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const projectStatusSchema = z.enum(["planning", "active", "on_hold", "completed", "archived"]);
export const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "in_review", "done"]);
export const taskLabelSchema = z.enum([
  "design",
  "frontend",
  "backend",
  "research",
  "bug",
  "infra",
  "content",
  "qa",
  "growth",
  "ops",
]);
export const eventTypeSchema = z.enum(["meeting", "deadline", "milestone", "focus"]);

const uuid = z.string().uuid();
const isoInstant = z
  .string()
  .datetime({ offset: true, message: "Expected an ISO-8601 timestamp." })
  .or(z.string().datetime().transform((value) => `${value}Z`));

/* --------------------------------- Params -------------------------------- */

export const projectIdParamSchema = z.object({ projectId: uuid });
export const taskIdParamSchema = z.object({ taskId: uuid });
export const taskChildParamSchema = z.object({ taskId: uuid, subtaskId: uuid });
export const attachmentParamSchema = z.object({ taskId: uuid, attachmentId: uuid });
export const eventIdParamSchema = z.object({ eventId: uuid });
export const workspaceIdParamSchema = z.object({ workspaceId: uuid });

/* -------------------------------- Projects ------------------------------- */

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(2, "Give the project a name.").max(160),
  description: z.string().trim().max(320, "Keep the brief under 320 characters.").default(""),
  status: projectStatusSchema.default("planning"),
  priority: prioritySchema.default("medium"),
  dueDate: isoInstant,
  startDate: isoInstant.optional(),
  memberIds: z.array(uuid).min(1, "Select at least one person.").max(200),
  colorHue: z.number().int().min(0).max(360).optional(),
});

export const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(2, "Give the project a name.").max(160).optional(),
    description: z.string().trim().max(320).optional(),
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: isoInstant.optional(),
    memberIds: z.array(uuid).min(1).max(200).optional(),
    colorHue: z.number().int().min(0).max(360).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["updated", "due", "name", "progress"]).optional(),
  include: z.string().trim().optional(),
});

/* --------------------------------- Tasks --------------------------------- */

export const createTaskBodySchema = z.object({
  projectId: uuid,
  title: z.string().trim().min(2, "Describe the task in a few words.").max(300),
  description: z.string().trim().max(600, "Keep the detail under 600 characters.").default(""),
  status: taskStatusSchema.default("todo"),
  priority: prioritySchema.default("medium"),
  assigneeId: uuid.nullable().optional(),
  dueDate: isoInstant.nullable().optional(),
  labels: z.array(taskLabelSchema).max(10).default([]),
});

export const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(2).max(300).optional(),
    description: z.string().trim().max(5000).optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: uuid.nullable().optional(),
    dueDate: isoInstant.nullable().optional(),
    labels: z.array(taskLabelSchema).max(10).optional(),
    projectId: uuid.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const moveTaskBodySchema = z.object({
  status: taskStatusSchema,
  index: z.number().int().min(0).max(10_000),
});

export const listTasksQuerySchema = z.object({
  assignee: z.string().trim().max(80).optional(),
  priority: prioritySchema.optional(),
  project: uuid.optional(),
  label: taskLabelSchema.optional(),
  status: taskStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export const createSubtaskBodySchema = z.object({
  title: z.string().trim().min(1, "Give the subtask a title.").max(300),
});

export const updateSubtaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    done: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const createCommentBodySchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000, "Keep the comment under 4000 characters."),
});

export const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: isoInstant.optional(),
});

export const createAttachmentBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().min(0).max(1024 * 1024 * 1024),
  mimeType: z.string().trim().min(1).max(255),
});

/* -------------------------------- Calendar ------------------------------- */

export const createEventBodySchema = z
  .object({
    title: z.string().trim().min(2, "Name the event.").max(200),
    description: z.string().trim().max(320).default(""),
    type: eventTypeSchema,
    projectId: uuid.nullable().optional(),
    start: isoInstant,
    end: isoInstant,
    allDay: z.boolean().default(false),
    attendeeIds: z.array(uuid).min(1, "Invite at least one person.").max(200),
    location: z.string().trim().max(80).default(""),
  })
  .refine((value) => new Date(value.end).getTime() > new Date(value.start).getTime(), {
    path: ["end"],
    message: "The end time must be after the start.",
  });

export const updateEventBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    type: eventTypeSchema.optional(),
    projectId: uuid.nullable().optional(),
    start: isoInstant.optional(),
    end: isoInstant.optional(),
    allDay: z.boolean().optional(),
    attendeeIds: z.array(uuid).min(1).max(200).optional(),
    location: z.string().trim().max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const listEventsQuerySchema = z.object({
  from: isoInstant.optional(),
  to: isoInstant.optional(),
});

/* ------------------------------- Notifications --------------------------- */

export const listNotificationsQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const notificationIdParamSchema = z.object({ notificationId: uuid });

/* -------------------------------- Activity ------------------------------- */

export const listActivityQuerySchema = z.object({
  projectId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: isoInstant.optional(),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type MoveTaskBody = z.infer<typeof moveTaskBodySchema>;
export type CreateEventBody = z.infer<typeof createEventBodySchema>;
export type UpdateEventBody = z.infer<typeof updateEventBodySchema>;
