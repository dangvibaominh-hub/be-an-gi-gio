import type { Pool, PoolClient } from "pg";

import type { AuthProvider, UserRole, UserStatus } from "../auth/auth.model.js";
import { normalizeIngredientName } from "../recommendations/ingredient-normalizer.js";
import type { RecipeModel } from "../recipes/recipe.model.js";
import type {
  AdminAuditLogModel,
  AdminRecipeDetailModel,
  AdminRecipeIngredientModel,
  AdminRecipeModel,
  AdminRecipeStepModel,
  AdminUserModel,
  ModerationStatus,
  PaginatedAdminResult,
  RecipeSource,
  RecipeStatus,
} from "./admin.model.js";
import type {
  AdminCreateRecipeInput,
  AdminListAuditLogsQuery,
  AdminListRecipesQuery,
  AdminListUsersQuery,
  AdminRecipeIngredientInput,
  AdminRecipeStepInput,
  AdminUpdateRecipeInput,
} from "./admin.types.js";

interface AdminRecipeRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
  difficulty: RecipeModel["difficulty"];
  cook_time_minutes: number;
  base_servings: number;
  category_id: string;
  category_slug: string;
  category_name: RecipeModel["category"];
  status: RecipeStatus;
  source: RecipeSource;
  ai_model: string | null;
  moderation_status: ModerationStatus;
  created_by: string | null;
  created_by_email: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdminRecipeIngredientRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
  prep_note: string;
  display_order: number;
}

interface AdminRecipeStepRow {
  id: string;
  display_order: number;
  content: string;
  estimated_minutes: number;
  technique_icon: AdminRecipeStepModel["techniqueIcon"];
  is_tricky: boolean;
  timer_seconds: number | null;
}

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider;
  created_at: Date;
  updated_at: Date;
}

interface AdminAuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: "recipe" | "user";
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: Date;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: RecipeModel["category"];
}

interface SavedIngredientRow {
  id: string;
  name: string;
}

export interface CreateAuditLogInput {
  actorUserId: string;
  action: string;
  entityType: "recipe" | "user";
  entityId: string | null;
  details?: Record<string, unknown>;
}

export interface AdminRepository {
  listRecipes(
    query: AdminListRecipesQuery,
  ): Promise<PaginatedAdminResult<AdminRecipeModel>>;
  findRecipeById(recipeId: string): Promise<AdminRecipeDetailModel | null>;
  createRecipe(
    input: AdminCreateRecipeInput,
    actorUserId: string,
  ): Promise<AdminRecipeDetailModel>;
  updateRecipe(
    recipeId: string,
    input: AdminUpdateRecipeInput,
  ): Promise<AdminRecipeDetailModel | null>;
  setRecipeStatus(
    recipeId: string,
    status: RecipeStatus,
  ): Promise<AdminRecipeDetailModel | null>;
  setRecipeModeration(
    recipeId: string,
    moderationStatus: Extract<ModerationStatus, "APPROVED" | "REJECTED">,
    status: RecipeStatus,
  ): Promise<AdminRecipeDetailModel | null>;
  listUsers(
    query: AdminListUsersQuery,
  ): Promise<PaginatedAdminResult<AdminUserModel>>;
  updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<AdminUserModel | null>;
  revokeUserRefreshTokens(userId: string): Promise<void>;
  createAuditLog(input: CreateAuditLogInput): Promise<AdminAuditLogModel>;
  listAuditLogs(
    query: AdminListAuditLogsQuery,
  ): Promise<PaginatedAdminResult<AdminAuditLogModel>>;
}

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly database: Pool) {}

  async listRecipes(query: AdminListRecipesQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.status !== undefined) {
      values.push(query.status);
      conditions.push(`r.status = $${values.length}::recipe_status`);
    }

    if (query.source !== undefined) {
      values.push(query.source);
      conditions.push(`r.source = $${values.length}::recipe_source`);
    }

    if (query.moderationStatus !== undefined) {
      values.push(query.moderationStatus);
      conditions.push(
        `r.moderation_status = $${values.length}::moderation_status`,
      );
    }

    const whereClause =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM recipes r
       ${whereClause}`,
      values,
    );

    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);

    const result = await this.database.query<AdminRecipeRow>(
      `${recipeSelectSql()}
       ${whereClause}
       ORDER BY r.updated_at DESC, r.title
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapRecipeRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async findRecipeById(recipeId: string) {
    const result = await this.database.query<AdminRecipeRow>(
      `${recipeSelectSql()}
       WHERE r.id = $1
       LIMIT 1`,
      [recipeId],
    );
    const recipe = result.rows[0];

    if (recipe === undefined) {
      return null;
    }

    const [ingredients, steps] = await Promise.all([
      this.listRecipeIngredients(recipe.id),
      this.listRecipeSteps(recipe.id),
    ]);

    return {
      ...mapRecipeRow(recipe),
      ingredients,
      steps,
    };
  }

  async createRecipe(input: AdminCreateRecipeInput, actorUserId: string) {
    const client = await this.database.connect();
    let recipeId: string | undefined;

    try {
      await client.query("BEGIN");
      const category = await findCategoryBySlug(client, input.categorySlug);

      const result = await client.query<{ id: string }>(
        `INSERT INTO recipes (
           slug,
           title,
           description,
           image_url,
           image_alt,
           difficulty,
           cook_time_minutes,
           base_servings,
           category_id,
           status,
           source,
           moderation_status,
           created_by
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6::recipe_difficulty,
           $7,
           $8,
           $9,
           $10::recipe_status,
           'ADMIN',
           'APPROVED',
           $11
         )
         RETURNING id`,
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
          actorUserId,
        ],
      );
      recipeId = result.rows[0]?.id;

      if (recipeId === undefined) {
        throw new Error("Recipe was not created.");
      }

      await insertRecipeIngredients(client, recipeId, input.ingredients);
      await insertRecipeSteps(client, recipeId, input.steps);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const recipe = await this.findRecipeById(recipeId);
    if (recipe === null) {
      throw new Error("Created recipe could not be loaded.");
    }

    return recipe;
  }

  async updateRecipe(recipeId: string, input: AdminUpdateRecipeInput) {
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");

      const exists = await recipeExists(client, recipeId);
      if (!exists) {
        await client.query("ROLLBACK");
        return null;
      }

      const values: unknown[] = [];
      const setClauses: string[] = [];

      addUpdate(setClauses, values, "slug", input.slug);
      addUpdate(setClauses, values, "title", input.title);
      addUpdate(setClauses, values, "description", input.description);
      addUpdate(setClauses, values, "image_url", input.image);
      addUpdate(setClauses, values, "image_alt", input.imageAlt);
      addUpdate(
        setClauses,
        values,
        "difficulty",
        input.difficulty,
        "recipe_difficulty",
      );
      addUpdate(setClauses, values, "cook_time_minutes", input.cookTimeMinutes);
      addUpdate(setClauses, values, "base_servings", input.baseServings);
      addUpdate(
        setClauses,
        values,
        "status",
        input.status,
        "recipe_status",
      );

      if (input.categorySlug !== undefined) {
        const category = await findCategoryBySlug(client, input.categorySlug);
        addUpdate(setClauses, values, "category_id", category.id);
      }

      if (setClauses.length > 0) {
        values.push(recipeId);
        await client.query(
          `UPDATE recipes
           SET ${setClauses.join(", ")},
               updated_at = NOW()
           WHERE id = $${values.length}`,
          values,
        );
      } else {
        await client.query(
          `UPDATE recipes
           SET updated_at = NOW()
           WHERE id = $1`,
          [recipeId],
        );
      }

      if (input.ingredients !== undefined) {
        await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [
          recipeId,
        ]);
        await insertRecipeIngredients(client, recipeId, input.ingredients);
      }

      if (input.steps !== undefined) {
        await client.query("DELETE FROM recipe_steps WHERE recipe_id = $1", [
          recipeId,
        ]);
        await insertRecipeSteps(client, recipeId, input.steps);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.findRecipeById(recipeId);
  }

  async setRecipeStatus(recipeId: string, status: RecipeStatus) {
    const result = await this.database.query<{ id: string }>(
      `UPDATE recipes
       SET status = $2::recipe_status,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [recipeId, status],
    );

    if (result.rows[0] === undefined) {
      return null;
    }

    return this.findRecipeById(recipeId);
  }

  async setRecipeModeration(
    recipeId: string,
    moderationStatus: Extract<ModerationStatus, "APPROVED" | "REJECTED">,
    status: RecipeStatus,
  ) {
    const result = await this.database.query<{ id: string }>(
      `UPDATE recipes
       SET moderation_status = $2::moderation_status,
           status = $3::recipe_status,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [recipeId, moderationStatus, status],
    );

    if (result.rows[0] === undefined) {
      return null;
    }

    return this.findRecipeById(recipeId);
  }

  async listUsers(query: AdminListUsersQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.role !== undefined) {
      values.push(query.role);
      conditions.push(`role = $${values.length}::user_role`);
    }

    if (query.status !== undefined) {
      values.push(query.status);
      conditions.push(`status = $${values.length}::user_status`);
    }

    const whereClause =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM app_users
       ${whereClause}`,
      values,
    );
    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);
    const result = await this.database.query<AdminUserRow>(
      `SELECT id, email, display_name, avatar_url, role, status, provider,
              created_at, updated_at
       FROM app_users
       ${whereClause}
       ORDER BY created_at DESC, email
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapUserRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const result = await this.database.query<AdminUserRow>(
      `UPDATE app_users
       SET status = $2::user_status,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, avatar_url, role, status, provider,
                 created_at, updated_at`,
      [userId, status],
    );

    return result.rows[0] === undefined ? null : mapUserRow(result.rows[0]);
  }

  async revokeUserRefreshTokens(userId: string) {
    await this.database.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  }

  async createAuditLog(input: CreateAuditLogInput) {
    const result = await this.database.query<AdminAuditLogRow>(
      `INSERT INTO admin_audit_logs (
         actor_user_id,
         action,
         entity_type,
         entity_id,
         details
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, actor_user_id, action, entity_type, entity_id, details,
                 created_at`,
      [
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId,
        JSON.stringify(input.details ?? {}),
      ],
    );
    const log = result.rows[0];

    if (log === undefined) {
      throw new Error("Audit log was not created.");
    }

    return mapAuditLogRow(log);
  }

  async listAuditLogs(query: AdminListAuditLogsQuery) {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (query.actorUserId !== undefined) {
      values.push(query.actorUserId);
      conditions.push(`actor_user_id = $${values.length}`);
    }

    if (query.entityType !== undefined) {
      values.push(query.entityType);
      conditions.push(`entity_type = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM admin_audit_logs
       ${whereClause}`,
      values,
    );
    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);
    const result = await this.database.query<AdminAuditLogRow>(
      `SELECT id, actor_user_id, action, entity_type, entity_id, details,
              created_at
       FROM admin_audit_logs
       ${whereClause}
       ORDER BY created_at DESC
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

  private async listRecipeIngredients(recipeId: string) {
    const result = await this.database.query<AdminRecipeIngredientRow>(
      `SELECT i.id, i.name, ri.amount, ri.unit, ri.prep_note, ri.display_order
       FROM recipe_ingredients ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = $1
       ORDER BY ri.display_order`,
      [recipeId],
    );

    return result.rows.map(mapIngredientRow);
  }

  private async listRecipeSteps(recipeId: string) {
    const result = await this.database.query<AdminRecipeStepRow>(
      `SELECT id, display_order, content, estimated_minutes, technique_icon,
              is_tricky, timer_seconds
       FROM recipe_steps
       WHERE recipe_id = $1
       ORDER BY display_order`,
      [recipeId],
    );

    return result.rows.map(mapStepRow);
  }
}

function recipeSelectSql() {
  return `SELECT
      r.id,
      r.slug,
      r.title,
      r.description,
      r.image_url,
      r.image_alt,
      r.difficulty,
      r.cook_time_minutes,
      r.base_servings,
      c.id AS category_id,
      c.slug AS category_slug,
      c.name AS category_name,
      r.status,
      r.source,
      r.ai_model,
      r.moderation_status,
      r.created_by,
      u.email AS created_by_email,
      r.created_at,
      r.updated_at
    FROM recipes r
    JOIN categories c ON c.id = r.category_id
    LEFT JOIN app_users u ON u.id = r.created_by`;
}

function mapRecipeRow(row: AdminRecipeRow): AdminRecipeModel {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    image: row.image_url,
    imageAlt: row.image_alt,
    difficulty: row.difficulty,
    cookTimeMinutes: row.cook_time_minutes,
    baseServings: row.base_servings,
    category: {
      id: row.category_id,
      slug: row.category_slug,
      name: row.category_name,
    },
    status: row.status,
    source: row.source,
    aiModel: row.ai_model,
    moderationStatus: row.moderation_status,
    createdBy:
      row.created_by === null
        ? null
        : { id: row.created_by, email: row.created_by_email },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapIngredientRow(
  row: AdminRecipeIngredientRow,
): AdminRecipeIngredientModel {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    unit: row.unit,
    prepNote: row.prep_note,
    displayOrder: row.display_order,
  };
}

function mapStepRow(row: AdminRecipeStepRow): AdminRecipeStepModel {
  return {
    id: row.id,
    displayOrder: row.display_order,
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
    techniqueIcon: row.technique_icon,
    isTricky: row.is_tricky,
    timerSeconds: row.timer_seconds,
  };
}

function mapUserRow(row: AdminUserRow): AdminUserModel {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    provider: row.provider,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAuditLogRow(row: AdminAuditLogRow): AdminAuditLogModel {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

async function recipeExists(client: PoolClient, recipeId: string) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM recipes WHERE id = $1 LIMIT 1",
    [recipeId],
  );

  return result.rows[0] !== undefined;
}

async function findCategoryBySlug(client: PoolClient, slug: string) {
  const result = await client.query<CategoryRow>(
    `SELECT id, slug, name
     FROM categories
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  );
  const category = result.rows[0];

  if (category === undefined) {
    const error = new Error(`Category not found: ${slug}`);
    Object.assign(error, { code: "CATEGORY_NOT_FOUND" });
    throw error;
  }

  return category;
}

function addUpdate(
  setClauses: string[],
  values: unknown[],
  column: string,
  value: unknown,
  enumType?: string,
) {
  if (value === undefined) {
    return;
  }

  values.push(value);
  const cast = enumType === undefined ? "" : `::${enumType}`;
  setClauses.push(`${column} = $${values.length}${cast}`);
}

async function insertRecipeIngredients(
  client: PoolClient,
  recipeId: string,
  ingredients: AdminRecipeIngredientInput[],
) {
  for (const [index, ingredient] of ingredients.entries()) {
    const normalizedName = normalizeIngredientName(ingredient.name);
    const ingredientResult = await client.query<SavedIngredientRow>(
      `INSERT INTO ingredients (name, normalized_name, aliases)
       VALUES ($1, $2, '{}')
       ON CONFLICT (normalized_name) DO UPDATE
         SET name = EXCLUDED.name,
             updated_at = NOW()
       RETURNING id, name`,
      [ingredient.name, normalizedName],
    );
    const savedIngredient = ingredientResult.rows[0];

    if (savedIngredient === undefined) {
      throw new Error(`Ingredient was not saved: ${ingredient.name}`);
    }

    await client.query(
      `INSERT INTO recipe_ingredients (
         recipe_id,
         ingredient_id,
         amount,
         unit,
         prep_note,
         display_order
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        recipeId,
        savedIngredient.id,
        ingredient.amount,
        ingredient.unit,
        ingredient.prepNote,
        index + 1,
      ],
    );
  }
}

async function insertRecipeSteps(
  client: PoolClient,
  recipeId: string,
  steps: AdminRecipeStepInput[],
) {
  for (const [index, step] of steps.entries()) {
    await client.query(
      `INSERT INTO recipe_steps (
         recipe_id,
         display_order,
         content,
         estimated_minutes,
         technique_icon,
         is_tricky,
         timer_seconds
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        recipeId,
        index + 1,
        step.content,
        step.estimatedMinutes,
        step.techniqueIcon,
        step.isTricky,
        step.timerSeconds,
      ],
    );
  }
}
