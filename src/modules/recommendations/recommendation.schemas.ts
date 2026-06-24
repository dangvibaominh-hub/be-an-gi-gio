import { z } from "zod";

import { normalizeIngredientName } from "./ingredient-normalizer.js";

const difficultySchema = z.enum(["de", "trung-binh", "kho"]);

const ingredientSchema = z.string().trim().min(1).max(80);

const filtersSchema = z
  .object({
    category: z.string().trim().min(1).max(100).optional(),
    difficulties: z.array(difficultySchema).min(1).max(3).optional(),
    maxCookTimeMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    servings: z.coerce.number().int().min(1).max(100).optional(),
  })
  .default({});

export const recommendationRequestSchema = z
  .object({
    ingredients: z
      .array(ingredientSchema)
      .min(1)
      .max(30)
      .transform(dedupeIngredients),
    filters: filtersSchema,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
  })
  .transform(({ filters, ...body }) => ({
    ...body,
    filters: {
      ...(filters.category === undefined ? {} : { category: filters.category }),
      ...(filters.difficulties === undefined
        ? {}
        : { difficulties: filters.difficulties }),
      ...(filters.maxCookTimeMinutes === undefined
        ? {}
        : { maxCookTimeMinutes: filters.maxCookTimeMinutes }),
      ...(filters.servings === undefined ? {} : { servings: filters.servings }),
    },
  }));

function dedupeIngredients(values: string[]) {
  const seen = new Set<string>();
  const ingredients: string[] = [];

  for (const value of values) {
    const normalized = normalizeIngredientName(value);

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    ingredients.push(value.trim());
  }

  return ingredients;
}
