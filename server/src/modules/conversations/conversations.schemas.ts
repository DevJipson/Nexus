import { z } from "zod";

export const conversationIdParamSchema = z.object({ conversationId: z.string().uuid() });

export const listMessagesQuerySchema = z.object({
  before: z.string().datetime({ offset: true, message: "Expected an ISO-8601 timestamp." }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const uuid = z.string().uuid();

export const createConversationBodySchema = z.object({
  kind: z.enum(["direct", "group"]),
  name: z.string().trim().min(2, "Group name must be at least 2 characters.").max(120).nullish(),
  participantIds: z.array(uuid).min(1, "Choose at least one person.").max(200),
  projectId: uuid.nullish(),
  firstMessage: z.string().trim().max(1000).optional(),
});

export const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000, "Keep the message under 4000 characters."),
});

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
