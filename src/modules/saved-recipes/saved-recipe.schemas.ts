import { z } from "zod";

export const savedRecipeSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug không hợp lệ."),
});
