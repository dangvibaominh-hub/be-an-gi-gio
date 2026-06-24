import type { Pool } from "pg";

import type {
  AdminRecipeDetailModel,
  AdminRecipeSummaryModel,
  AdminUserModel,
  AuditLogModel,
} from "./admin.model.js";
import type {
  AdminRecipeListQuery,
  AdminUserListQuery,
  AuditLogQuery,
  CreateRecipeInput,
  UpdateRecipeInput,
  UpdateUserStatusInput,
} from "./admin.schemas.js";

// ── Row types ────────────────────────────────────────────────────────────────

interface AdminRecipeRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
  difficulty: string;
  cook_time_minutes: number;
  base_servings: number;
  category_name: string;
  status: string;
  source: string;
  moderation_status: string;
  created_at: Date;
  updated_at: Date;
}

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: Date;
}

interface AuditLogRow {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Repository interface ─────────────────────────────────────────────────────

export interface AdminRepository {
  // Recipes
  listRecipes(
    query: AdminRecipeListQuery,
  ): Promise<PaginatedResult<AdminRecipeSummaryModel>>;
  findRecipeById(id: string): Promise<AdminRecipeDetailModel | null>;
  createRecipe(
    adminUserId: string,
    input: CreateRecipeInput,
  ): Promise<AdminRecipeDetailModel>;
  updateRecipe(
    adminUserId: string,
    id: string,
    input: UpdateRecipeInput,
  ): Promise<AdminRecipeDetailModel | null>;
  softDeleteRecipe(adminUserId: string, id: string): Promise<boolean>;
  approveRecipe(
    adminUserId: string,
    id: string,
  ): Promise<AdminRecipeDetailModel | null>;
  rejectRecipe(
    adminUserId: string,
    id: string,
  ): Promise<AdminRecipeDetailModel | null>;

  // Users
  listUsers(
    query: AdminUserListQuery,
  ): Promise<PaginatedResult<AdminUserModel>>;
  updateUserStatus(
    adminUserId: string,
    id: string,
    input: UpdateUserStatusInput,
  ): Promise<AdminUserModel | null>;

  // Audit logs
  listAuditLogs(query: AuditLogQuery): Promise<PaginatedResult<AuditLogModel>>;
  createAuditLog(entry: {
    adminUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

// ── PostgresAdminRepository ──────────────────────────────────────────────────

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly database: Pool) {}

  // ── Recipes ──────────────────────────────────────────────────────────────

  async listRecipes(query: AdminRecipeListQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.status !== undefined) {
      values.push(query.status);
      conditions.push(`r.status = $${values.length}`);
    }

    if (query.moderationStatus !== undefined) {
      values.push(query.moderationStatus);
      conditions.push(`r.moderation_status = $${values.length}`);
    }

    if (query.source !== undefined) {
      values.push(query.source);
      conditions.push(`r.source = $${values.length}`);
    }

    if (query.search !== undefined && query.search.trim() !== "") {
      values.push(`%${query.search.trim()}%`);
      conditions.push(`(r.title ILIKE $${values.length} OR r.slug ILIKE $${values.length})`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       ${whereClause}`,
      values,
    );

    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);

    const result = await this.database.query<AdminRecipeRow>(
      `SELECT
         r.id,
         r.slug,
         r.title,
         r.description,
         r.image_url,
         r.image_alt,
         r.difficulty,
         r.cook_time_minutes,
         r.base_servings,
         c.name AS category_name,
         r.status,
         r.source,
         r.moderation_status,
         r.created_at,
         r.updated_at
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapAdminRecipeRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async findRecipeById(id: string) {
    const result = await this.database.query<AdminRecipeRow>(
      `SELECT
         r.id,
         r.slug,
         r.title,
         r.description,
         r.image_url,
         r.image_alt,
         r.difficulty,
         r.cook_time_minutes,
         r.base_servings,
         c.name AS category_name,
         r.status,
         r.source,
         r.moderation_status,
         r.created_at,
         r.updated_at
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       WHERE r.id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return mapAdminRecipeDetailRow(row);
  }

  async createRecipe(adminUserId: string, input: CreateRecipeInput) {
    const categoryResult = await this.database.query<{ id: string }>(
      `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
      [input.categorySlug],
    );

    const category = categoryResult.rows[0];
    if (category === undefined) {
      throw new Error(`Danh mục "${input.categorySlug}" không tồn tại.`);
    }

    const result = await this.database.query<AdminRecipeRow>(
      `INSERT INTO recipes (
         slug, title, description, image_url, image_alt,
         difficulty, cook_time_minutes, base_servings,
         category_id, status, source, moderation_status, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ADMIN', 'APPROVED', $11)
       RETURNING
         id, slug, title, description, image_url, image_alt,
         difficulty, cook_time_minutes, base_servings,
         (SELECT name FROM categories WHERE id = category_id) AS category_name,
         status, source, moderation_status, created_at, updated_at`,
      [
        input.slug,
        input.title,
        input.description,
        input.image,
        input.imageAlt,
        input.difficulty,
        input.cookTimeMinutes,
        input.baseServings,
        category.id,
        input.status,
        adminUserId,
      ],
    );

    const row = result.rows[0];
    if (row === undefined) throw new Error("Recipe was not created.");

    await this.createAuditLog({
      adminUserId,
      action: "CREATE_RECIPE",
      entityType: "recipe",
      entityId: row.id,
      metadata: { slug: row.slug, title: row.title },
    });

    return mapAdminRecipeDetailRow(row);
  }

  async updateRecipe(adminUserId: string, id: string, input: UpdateRecipeInput) {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      values.push(input.title);
      sets.push(`title = $${values.length}`);
    }
    if (input.description !== undefined) {
      values.push(input.description);
      sets.push(`description = $${values.length}`);
    }
    if (input.image !== undefined) {
      values.push(input.image);
      sets.push(`image_url = $${values.length}`);
    }
    if (input.imageAlt !== undefined) {
      values.push(input.imageAlt);
      sets.push(`image_alt = $${values.length}`);
    }
    if (input.difficulty !== undefined) {
      values.push(input.difficulty);
      sets.push(`difficulty = $${values.length}`);
    }
    if (input.cookTimeMinutes !== undefined) {
      values.push(input.cookTimeMinutes);
      sets.push(`cook_time_minutes = $${values.length}`);
    }
    if (input.baseServings !== undefined) {
      values.push(input.baseServings);
      sets.push(`base_servings = $${values.length}`);
    }
    if (input.categorySlug !== undefined) {
      const catResult = await this.database.query<{ id: string }>(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [input.categorySlug],
      );
      const cat = catResult.rows[0];
      if (cat === undefined)
        throw new Error(`Danh mục "${input.categorySlug}" không tồn tại.`);
      values.push(cat.id);
      sets.push(`category_id = $${values.length}`);
    }
    if (input.status !== undefined) {
      values.push(input.status);
      sets.push(`status = $${values.length}`);
    }
    if (input.moderationStatus !== undefined) {
      values.push(input.moderationStatus);
      sets.push(`moderation_status = $${values.length}`);
    }

    if (sets.length === 0) return this.findRecipeById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.database.query<AdminRecipeRow>(
      `UPDATE recipes r
       SET ${sets.join(", ")}
       FROM categories c
       WHERE r.id = $${values.length}
         AND c.id = r.category_id
       RETURNING
         r.id, r.slug, r.title, r.description, r.image_url, r.image_alt,
         r.difficulty, r.cook_time_minutes, r.base_servings,
         c.name AS category_name,
         r.status, r.source, r.moderation_status, r.created_at, r.updated_at`,
      values,
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    await this.createAuditLog({
      adminUserId,
      action: "UPDATE_RECIPE",
      entityType: "recipe",
      entityId: id,
      metadata: { ...input },
    });

    return mapAdminRecipeDetailRow(row);
  }

  async softDeleteRecipe(adminUserId: string, id: string) {
    const result = await this.database.query<{ id: string }>(
      `UPDATE recipes
       SET status = 'HIDDEN', updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) return false;

    await this.createAuditLog({
      adminUserId,
      action: "DELETE_RECIPE",
      entityType: "recipe",
      entityId: id,
    });

    return true;
  }

  async approveRecipe(adminUserId: string, id: string) {
    const result = await this.database.query<AdminRecipeRow>(
      `UPDATE recipes r
       SET moderation_status = 'APPROVED', status = 'PUBLISHED', updated_at = NOW()
       FROM categories c
       WHERE r.id = $1
         AND c.id = r.category_id
       RETURNING
         r.id, r.slug, r.title, r.description, r.image_url, r.image_alt,
         r.difficulty, r.cook_time_minutes, r.base_servings,
         c.name AS category_name,
         r.status, r.source, r.moderation_status, r.created_at, r.updated_at`,
      [id],
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    await this.createAuditLog({
      adminUserId,
      action: "APPROVE_RECIPE",
      entityType: "recipe",
      entityId: id,
      metadata: { source: row.source },
    });

    return mapAdminRecipeDetailRow(row);
  }

  async rejectRecipe(adminUserId: string, id: string) {
    const result = await this.database.query<AdminRecipeRow>(
      `UPDATE recipes r
       SET moderation_status = 'REJECTED', status = 'HIDDEN', updated_at = NOW()
       FROM categories c
       WHERE r.id = $1
         AND c.id = r.category_id
       RETURNING
         r.id, r.slug, r.title, r.description, r.image_url, r.image_alt,
         r.difficulty, r.cook_time_minutes, r.base_servings,
         c.name AS category_name,
         r.status, r.source, r.moderation_status, r.created_at, r.updated_at`,
      [id],
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    await this.createAuditLog({
      adminUserId,
      action: "REJECT_RECIPE",
      entityType: "recipe",
      entityId: id,
      metadata: { source: row.source },
    });

    return mapAdminRecipeDetailRow(row);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUserListQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.status !== undefined) {
      values.push(query.status);
      conditions.push(`status = $${values.length}`);
    }

    if (query.role !== undefined) {
      values.push(query.role);
      conditions.push(`role = $${values.length}`);
    }

    if (query.search !== undefined && query.search.trim() !== "") {
      values.push(`%${query.search.trim()}%`);
      conditions.push(
        `(email ILIKE $${values.length} OR display_name ILIKE $${values.length})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM app_users ${whereClause}`,
      values,
    );

    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);

    const result = await this.database.query<AdminUserRow>(
      `SELECT id, email, display_name, avatar_url, role, status, created_at
       FROM app_users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapAdminUserRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async updateUserStatus(
    adminUserId: string,
    id: string,
    input: UpdateUserStatusInput,
  ) {
    const result = await this.database.query<AdminUserRow>(
      `UPDATE app_users
       SET status = $1
       WHERE id = $2
       RETURNING id, email, display_name, avatar_url, role, status, created_at`,
      [input.status, id],
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    await this.createAuditLog({
      adminUserId,
      action: input.status === "BLOCKED" ? "BLOCK_USER" : "UNBLOCK_USER",
      entityType: "user",
      entityId: id,
      metadata: { email: row.email },
    });

    return mapAdminUserRow(row);
  }

  // ── Audit logs ────────────────────────────────────────────────────────────

  async listAuditLogs(query: AuditLogQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.entityType !== undefined) {
      values.push(query.entityType);
      conditions.push(`al.entity_type = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM admin_audit_logs al ${whereClause}`,
      values,
    );

    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);

    const result = await this.database.query<AuditLogRow>(
      `SELECT
         al.id,
         al.admin_user_id,
         u.email AS admin_email,
         al.action,
         al.entity_type,
         al.entity_id,
         al.metadata,
         al.created_at
       FROM admin_audit_logs al
       JOIN app_users u ON u.id = al.admin_user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapAuditLogRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async createAuditLog(entry: {
    adminUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.database.query(
      `INSERT INTO admin_audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.adminUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  }
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapAdminRecipeRow(row: AdminRecipeRow): AdminRecipeSummaryModel {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    cookTimeMinutes: row.cook_time_minutes,
    baseServings: row.base_servings,
    category: row.category_name,
    status: row.status as AdminRecipeSummaryModel["status"],
    source: row.source as AdminRecipeSummaryModel["source"],
    moderationStatus: row.moderation_status as AdminRecipeSummaryModel["moderationStatus"],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAdminRecipeDetailRow(row: AdminRecipeRow): AdminRecipeDetailModel {
  return {
    ...mapAdminRecipeRow(row),
    description: row.description,
    image: row.image_url,
    imageAlt: row.image_alt,
  };
}

function mapAdminUserRow(row: AdminUserRow): AdminUserModel {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role as AdminUserModel["role"],
    status: row.status as AdminUserModel["status"],
    createdAt: row.created_at.toISOString(),
  };
}

function mapAuditLogRow(row: AuditLogRow): AuditLogModel {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}
