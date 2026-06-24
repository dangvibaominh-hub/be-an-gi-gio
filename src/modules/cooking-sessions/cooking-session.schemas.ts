import { z } from "zod";

export const cookingSessionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const startCookingSessionSchema = z.object({
  recipeSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  servings: z.number().int().min(1).max(100).optional(),
});

export const updateCookingSessionSchema = z
  .object({
    currentStep: z.number().int().min(1).optional(),
    servings: z.number().int().min(1).max(100).optional(),
  })
  .refine(
    (value) => value.currentStep !== undefined || value.servings !== undefined,
    {
      message: "At least one field must be provided.",
    },
  );

export const cookingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  sort: z
    .enum(["completed-at-desc", "started-at-desc"])
    .default("completed-at-desc"),
});
