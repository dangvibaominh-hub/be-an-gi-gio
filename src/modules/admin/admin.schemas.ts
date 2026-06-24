import { z } from "zod";

// ── Recipe list query ────────────────────────────────────────────────────────
export const adminRecipeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  moderationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  source: z.enum(["ADMIN", "SEED", "GEMINI"]).optional(),
  search: z.string().optional(),
});

export type AdminRecipeListQuery = z.infer<typeof adminRecipeListQuerySchema>;

// ── Recipe ID params ─────────────────────────────────────────────────────────
export const adminRecipeIdParamsSchema = z.object({
  id: z.string().uuid("ID không hợp lệ."),
});

// ── Create recipe ────────────────────────────────────────────────────────────
export const createRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ được dùng ký tự thường, số và dấu gạch ngang."),
  description: z.string().min(1).max(2000),
  image: z.string().url("URL ảnh không hợp lệ."),
  imageAlt: z.string().min(1).max(200),
  difficulty: z.enum(["de", "trung-binh", "kho"]),
  cookTimeMinutes: z.number().int().min(1).max(1440),
  baseServings: z.number().int().min(1).max(100),
  categorySlug: z.string().min(1),
  status: z.enum(["PUBLISHED", "HIDDEN"]).default("PUBLISHED"),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

// ── Update recipe ────────────────────────────────────────────────────────────
export const updateRecipeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  image: z.string().url("URL ảnh không hợp lệ.").optional(),
  imageAlt: z.string().min(1).max(200).optional(),
  difficulty: z.enum(["de", "trung-binh", "kho"]).optional(),
  cookTimeMinutes: z.number().int().min(1).max(1440).optional(),
  baseServings: z.number().int().min(1).max(100).optional(),
  categorySlug: z.string().min(1).optional(),
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  moderationStatus: z.enum(["APPROVED", "REJECTED"]).optional(),
});

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

// ── User list query ──────────────────────────────────────────────────────────
export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  search: z.string().optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

// ── User ID params ───────────────────────────────────────────────────────────
export const adminUserIdParamsSchema = z.object({
  id: z.string().uuid("ID không hợp lệ."),
});

// ── Update user status ───────────────────────────────────────────────────────
export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED"]),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ── Audit log query ──────────────────────────────────────────────────────────
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.string().optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
