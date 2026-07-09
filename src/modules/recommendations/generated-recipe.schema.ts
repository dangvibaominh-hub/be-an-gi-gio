import { z } from "zod";

import { RECIPE_CATEGORIES } from "../recipes/recipe.model.js";

const difficultySchema = z.enum(["de", "trung-binh", "kho"]);
const techniqueIconSchema = z.enum(["dao", "chao", "noi", "tron", "hap"]);

const generatedIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    amount: z.number().positive().max(100_000),
    unit: z.string().trim().min(1).max(50),
    prepNote: z.string().trim().max(200).default(""),
  })
  .strict();

const generatedStepSchema = z
  .object({
    content: z.string().trim().min(10).max(600),
    estimatedMinutes: z.number().int().min(0).max(240),
    techniqueIcon: techniqueIconSchema,
    isTricky: z.boolean().default(false),
    timerSeconds: z
      .number()
      .int()
      .min(0)
      .max(86_400)
      .nullable()
      .default(null)
      .transform((value) => (value === 0 ? null : value)),
  })
  .strict();

export const generatedRecipeSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(20).max(800),
    imageAlt: z.string().trim().min(5).max(250),
    difficulty: difficultySchema,
    cookTimeMinutes: z.number().int().min(1).max(1_440),
    baseServings: z.number().int().min(1).max(100),
    category: z.enum(RECIPE_CATEGORIES),
    ingredients: z.array(generatedIngredientSchema).min(1).max(30),
    steps: z.array(generatedStepSchema).min(2).max(20),
  })
  .strict();

export type GeneratedRecipe = z.infer<typeof generatedRecipeSchema>;

export const geminiRecipeResponseSchema = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description: "Vietnamese recipe title.",
    },
    description: {
      type: "STRING",
      description: "Short Vietnamese summary of the dish.",
    },
    imageAlt: {
      type: "STRING",
      description: "Accessible Vietnamese image alt text for the finished dish.",
    },
    difficulty: {
      type: "STRING",
      enum: ["de", "trung-binh", "kho"],
    },
    cookTimeMinutes: {
      type: "INTEGER",
      description: "Total cooking time in minutes.",
    },
    baseServings: {
      type: "INTEGER",
      description: "Number of servings.",
    },
    category: {
      type: "STRING",
      enum: [...RECIPE_CATEGORIES],
    },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          amount: {
            type: "NUMBER",
            description: "Positive numeric amount only.",
          },
          unit: { type: "STRING" },
          prepNote: { type: "STRING" },
        },
        required: ["name", "amount", "unit", "prepNote"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          content: { type: "STRING" },
          estimatedMinutes: { type: "INTEGER" },
          techniqueIcon: {
            type: "STRING",
            enum: ["dao", "chao", "noi", "tron", "hap"],
          },
          isTricky: { type: "BOOLEAN" },
          timerSeconds: {
            type: "INTEGER",
          },
        },
        required: [
          "content",
          "estimatedMinutes",
          "techniqueIcon",
          "isTricky",
          "timerSeconds",
        ],
      },
    },
  },
  required: [
    "title",
    "description",
    "imageAlt",
    "difficulty",
    "cookTimeMinutes",
    "baseServings",
    "category",
    "ingredients",
    "steps",
  ],
} as const;
