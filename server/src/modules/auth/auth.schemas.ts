import { z } from "zod";
import { WORKSPACE_ROLES } from "../../types/domain";

/** Password policy shared by register, reset and change-password. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), {
    message: "Include both upper and lower case letters.",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "Include at least one number.",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const nameSchema = z.string().trim().min(2, "Use at least 2 characters.").max(120);
export const titleSchema = z.string().trim().max(120);
export const bioSchema = z.string().trim().max(1000);
export const locationSchema = z.string().trim().max(120);
export const timezoneSchema = z.string().trim().min(1).max(64);

export const registerBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  inviteToken: z.string().trim().min(10).max(200).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().trim().min(10).max(200),
});

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(10).max(200),
  password: passwordSchema,
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export const updateProfileBodySchema = z
  .object({
    name: nameSchema.optional(),
    title: titleSchema.optional(),
    bio: bioSchema.optional(),
    location: locationSchema.optional(),
    timezone: timezoneSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const updatePreferencesBodySchema = z
  .object({
    density: z.enum(["comfortable", "compact"]).optional(),
    reduceMotion: z.boolean().optional(),
    startOfWeek: z.union([z.literal(0), z.literal(1)]).optional(),
    emailDigest: z.boolean().optional(),
    taskAssigned: z.boolean().optional(),
    commentsMentions: z.boolean().optional(),
    dueDateReminders: z.boolean().optional(),
    projectUpdates: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

/* --------------------------------- Workspaces ---------------------------- */

export const workspaceIdParamSchema = z.object({ workspaceId: z.string().uuid() });
export const userIdParamSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});
export const invitationIdParamSchema = z.object({
  workspaceId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const createWorkspaceBodySchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
  description: z.string().trim().max(500).optional(),
});

export const updateWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(120).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

export const listMembersQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  role: z.enum([...WORKSPACE_ROLES, "all"]).optional(),
  include: z.string().trim().optional(),
});

export const updateMemberRoleBodySchema = z.object({
  role: z.enum(WORKSPACE_ROLES as unknown as [string, ...string[]]),
});

export const createInvitationBodySchema = z.object({
  email: emailSchema,
  role: z.enum(WORKSPACE_ROLES as unknown as [string, ...string[]]).default("member"),
  /** Optional override for where the accept link points (validated by caller). */
  redirectTo: z.string().trim().url().max(500).optional(),
});

export const acceptInvitationBodySchema = z.object({
  token: z.string().trim().min(10).max(200),
});

export const setActiveWorkspaceBodySchema = z.object({
  workspaceId: z.string().uuid(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;
