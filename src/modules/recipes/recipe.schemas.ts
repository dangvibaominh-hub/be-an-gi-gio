import { z } from "zod";

const difficultySchema = z.enum(["de", "trung-binh", "kho"]);

export const recipeListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    category: z.string().trim().min(1).max(100).optional(),
    difficulty: z
      .union([difficultySchema, z.array(difficultySchema)])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : Array.isArray(value) ? value : [value],
      ),
    maxCookTimeMinutes: z.coerce.number().int().positive().max(1440).optional(),
    servings: z.coerce.number().int().positive().max(100).optional(),
    sort: z
      .enum(["difficulty-asc", "cook-time-asc", "newest"])
      .default("difficulty-asc"),
  })
  .transform(({ difficulty, ...query }) => ({
    ...query,
    ...(difficulty === undefined ? {} : { difficulties: difficulty }),
  }));

export const recipeSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug không hợp lệ."),
});
