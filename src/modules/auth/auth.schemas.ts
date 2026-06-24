import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(8).max(128);
const displayNameSchema = z.string().trim().min(1).max(120);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = refreshTokenSchema;

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
});
