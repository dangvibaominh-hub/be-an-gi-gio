import { z } from "zod";

const recipeStatusSchema = z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]);
const recipeSourceSchema = z.enum(["ADMIN", "SEED", "GEMINI"]);
const moderationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const difficultySchema = z.enum(["de", "trung-binh", "kho"]);
const techniqueIconSchema = z.enum(["dao", "chao", "noi", "tron", "hap"]);
const userRoleSchema = z.enum(["USER", "ADMIN"]);
const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const uuidSchema = z.string().uuid();
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug không hợp lệ.");

const recipeIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    amount: z.number().positive().max(100_000),
    unit: z.string().trim().min(1).max(50),
    prepNote: z.string().trim().max(200).default(""),
  })
  .strict();

const recipeStepSchema = z
  .object({
    content: z.string().trim().min(10).max(600),
    estimatedMinutes: z.number().int().min(0).max(240),
    techniqueIcon: techniqueIconSchema,
    isTricky: z.boolean().default(false),
    timerSeconds: z.number().int().positive().max(86_400).nullable().default(null),
  })
  .strict();

export const adminRecipeIdParamsSchema = z.object({
  id: uuidSchema,
});

export const adminListRecipesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  status: recipeStatusSchema.optional(),
  source: recipeSourceSchema.optional(),
  moderationStatus: moderationStatusSchema.optional(),
});

export const adminCreateRecipeSchema = z
  .object({
    slug: slugSchema,
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(1_000),
    image: z.string().trim().min(1).max(500),
    imageAlt: z.string().trim().min(5).max(250),
    difficulty: difficultySchema,
    cookTimeMinutes: z.number().int().min(1).max(1_440),
    baseServings: z.number().int().min(1).max(100),
    categorySlug: slugSchema.max(80),
    status: recipeStatusSchema.default("DRAFT"),
    ingredients: z.array(recipeIngredientSchema).min(1).max(30),
    steps: z.array(recipeStepSchema).min(1).max(30),
  })
  .strict();

export const adminUpdateRecipeSchema = adminCreateRecipeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const adminModerateRecipeSchema = z
  .object({
    moderationStatus: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

export const adminListUsersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export const adminUserIdParamsSchema = z.object({
  id: uuidSchema,
});

export const adminUpdateUserStatusSchema = z
  .object({
    status: userStatusSchema,
  })
  .strict();

export const adminListAuditLogsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  actorUserId: uuidSchema.optional(),
  entityType: z.enum(["recipe", "user"]).optional(),
});
