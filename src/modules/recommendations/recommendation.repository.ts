import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool, PoolClient } from "pg";

import type { RecipeModel } from "../recipes/recipe.model.js";
import { normalizeIngredientName } from "./ingredient-normalizer.js";
import type { GeneratedRecipe } from "./generated-recipe.schema.js";
import type { RecommendationFilters } from "./recommendation.types.js";

export interface RecommendationCandidateIngredient {
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
}

export interface RecommendationCandidate extends RecipeModel {
  ingredients: RecommendationCandidateIngredient[];
}

export interface RecommendationRepository {
  listCandidates(
    filters: RecommendationFilters,
  ): Promise<RecommendationCandidate[]>;
}

export interface SaveGeneratedRecipeInput {
  recipe: GeneratedRecipe;
  slug: string;
  aiModel: string;
  createdBy?: string;
}

export interface GeneratedRecipeRepository {
  save(input: SaveGeneratedRecipeInput): Promise<RecommendationCandidate>;
}

interface CandidateRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
  difficulty: RecipeModel["difficulty"];
  cook_time_minutes: number;
  base_servings: number;
  category_name: RecipeModel["category"];
  ingredient_id: string;
  ingredient_name: string;
  normalized_name: string;
  aliases: string[];
}

type SupabaseCandidateRow = Omit<
  CandidateRow,
  | "category_name"
  | "ingredient_id"
  | "ingredient_name"
  | "normalized_name"
  | "aliases"
> & {
  category: { name: RecipeModel["category"] } | null;
  recipe_ingredients:
    | Array<{
        ingredient: {
          id: string;
          name: string;
          normalized_name: string;
          aliases: string[];
        } | null;
      }>
    | null;
};

interface SupabaseCategoryIdRow {
  id: string;
}

interface CategoryRow {
  id: string;
  name: RecipeModel["category"];
}

interface SavedRecipeRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
  difficulty: RecipeModel["difficulty"];
  cook_time_minutes: number;
  base_servings: number;
}

interface SavedIngredientRow {
  id: string;
  name: string;
  normalized_name: string;
  aliases: string[];
}

export class PostgresRecommendationRepository
  implements RecommendationRepository
{
  constructor(private readonly database: Pool) {}

  async listCandidates(
    filters: RecommendationFilters,
  ): Promise<RecommendationCandidate[]> {
    const values: unknown[] = [];
    const conditions = [
      "r.status = 'PUBLISHED'",
      "r.moderation_status = 'APPROVED'",
    ];

    if (filters.category !== undefined) {
      values.push(filters.category);
      conditions.push(
        `(c.slug = $${values.length} OR LOWER(c.name) = LOWER($${values.length}))`,
      );
    }

    if (filters.difficulties !== undefined) {
      values.push(filters.difficulties);
      conditions.push(`r.difficulty = ANY($${values.length}::recipe_difficulty[])`);
    }

    if (filters.maxCookTimeMinutes !== undefined) {
      values.push(filters.maxCookTimeMinutes);
      conditions.push(`r.cook_time_minutes <= $${values.length}`);
    }

    if (filters.servings !== undefined) {
      values.push(filters.servings);
      conditions.push(`r.base_servings = $${values.length}`);
    }

    const result = await this.database.query<CandidateRow>(
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
         i.id AS ingredient_id,
         i.name AS ingredient_name,
         i.normalized_name,
         i.aliases
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       JOIN recipe_ingredients ri ON ri.recipe_id = r.id
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.title, ri.display_order`,
      values,
    );

    return mapCandidateRows(result.rows);
  }
}

export class PostgresGeneratedRecipeRepository
  implements GeneratedRecipeRepository
{
  constructor(private readonly database: Pool) {}

  async save(input: SaveGeneratedRecipeInput): Promise<RecommendationCandidate> {
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");

      const category = await findCategory(client, input.recipe.category);
      const savedRecipe = await insertRecipe(client, input, category.id);
      const ingredients = await insertIngredients(client, savedRecipe.id, input.recipe);
      await insertSteps(client, savedRecipe.id, input.recipe);

      await client.query("COMMIT");

      return {
        id: savedRecipe.id,
        slug: savedRecipe.slug,
        title: savedRecipe.title,
        description: savedRecipe.description,
        image: savedRecipe.image_url,
        imageAlt: savedRecipe.image_alt,
        difficulty: savedRecipe.difficulty,
        cookTimeMinutes: savedRecipe.cook_time_minutes,
        baseServings: savedRecipe.base_servings,
        category: category.name,
        ingredients,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class SupabaseRecommendationRepository
  implements RecommendationRepository
{
  constructor(private readonly database: SupabaseClient) {}

  async listCandidates(
    filters: RecommendationFilters,
  ): Promise<RecommendationCandidate[]> {
    const categoryIds = await this.findCategoryIds(filters.category);

    if (filters.category !== undefined && categoryIds.length === 0) {
      return [];
    }

    let request = this.database
      .from("recipes")
      .select(
        `
          id,
          slug,
          title,
          description,
          image_url,
          image_alt,
          difficulty,
          cook_time_minutes,
          base_servings,
          category:categories!inner(name),
          recipe_ingredients!inner(
            ingredient:ingredients!inner(id, name, normalized_name, aliases)
          )
        `,
      )
      .eq("status", "PUBLISHED")
      .eq("moderation_status", "APPROVED");

    if (filters.category !== undefined) {
      request = request.in("category_id", categoryIds);
    }

    if (filters.difficulties !== undefined) {
      request = request.in("difficulty", filters.difficulties);
    }

    if (filters.maxCookTimeMinutes !== undefined) {
      request = request.lte("cook_time_minutes", filters.maxCookTimeMinutes);
    }

    if (filters.servings !== undefined) {
      request = request.eq("base_servings", filters.servings);
    }

    const { data, error } = await request
      .order("title", { ascending: true })
      .returns<SupabaseCandidateRow[]>();

    if (error !== null) {
      throw new Error(error.message);
    }

    return (data ?? []).map(mapSupabaseCandidateRow);
  }

  private async findCategoryIds(category: string | undefined) {
    if (category === undefined) {
      return [];
    }

    const bySlug = await this.database
      .from("categories")
      .select("id")
      .eq("slug", category)
      .returns<SupabaseCategoryIdRow[]>();

    if (bySlug.error !== null) {
      throw new Error(bySlug.error.message);
    }

    if ((bySlug.data ?? []).length > 0) {
      return (bySlug.data ?? []).map((row) => row.id);
    }

    const byName = await this.database
      .from("categories")
      .select("id")
      .ilike("name", category)
      .returns<SupabaseCategoryIdRow[]>();

    if (byName.error !== null) {
      throw new Error(byName.error.message);
    }

    return (byName.data ?? []).map((row) => row.id);
  }
}

function mapCandidateRows(rows: CandidateRow[]) {
  const candidates = new Map<string, RecommendationCandidate>();

  for (const row of rows) {
    const candidate = candidates.get(row.id);

    if (candidate === undefined) {
      candidates.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        image: row.image_url,
        imageAlt: row.image_alt,
        difficulty: row.difficulty,
        cookTimeMinutes: row.cook_time_minutes,
        baseServings: row.base_servings,
        category: row.category_name,
        ingredients: [
          {
            id: row.ingredient_id,
            name: row.ingredient_name,
            normalizedName: row.normalized_name,
            aliases: row.aliases,
          },
        ],
      });
      continue;
    }

    candidate.ingredients.push({
      id: row.ingredient_id,
      name: row.ingredient_name,
      normalizedName: row.normalized_name,
      aliases: row.aliases,
    });
  }

  return Array.from(candidates.values());
}

function mapSupabaseCandidateRow(
  row: SupabaseCandidateRow,
): RecommendationCandidate {
  if (row.category === null) {
    throw new Error("Missing category relation in Supabase response.");
  }

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
    category: row.category.name,
    ingredients: (row.recipe_ingredients ?? []).map((recipeIngredient) => {
      if (recipeIngredient.ingredient === null) {
        throw new Error("Missing ingredient relation in Supabase response.");
      }

      return {
        id: recipeIngredient.ingredient.id,
        name: recipeIngredient.ingredient.name,
        normalizedName: recipeIngredient.ingredient.normalized_name,
        aliases: recipeIngredient.ingredient.aliases,
      };
    }),
  };
}

async function findCategory(client: PoolClient, categoryName: RecipeModel["category"]) {
  const categoryResult = await client.query<CategoryRow>(
    `SELECT id, name
     FROM categories
     WHERE name = $1
     LIMIT 1`,
    [categoryName],
  );
  const category = categoryResult.rows[0];

  if (category === undefined) {
    throw new Error(`Recipe category not found: ${categoryName}`);
  }

  return category;
}

async function insertRecipe(
  client: PoolClient,
  input: SaveGeneratedRecipeInput,
  categoryId: string,
) {
  const result = await client.query<SavedRecipeRow>(
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
       ai_model,
       moderation_status,
       created_by
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9,
       'DRAFT',
       'GEMINI',
       $10,
       'PENDING',
       $11
     )
     RETURNING
       id,
       slug,
       title,
       description,
       image_url,
       image_alt,
       difficulty,
       cook_time_minutes,
       base_servings`,
    [
      input.slug,
      input.recipe.title,
      input.recipe.description,
      "/images/recipes/gemini-generated.png",
      input.recipe.imageAlt,
      input.recipe.difficulty,
      input.recipe.cookTimeMinutes,
      input.recipe.baseServings,
      categoryId,
      input.aiModel,
      input.createdBy ?? null,
    ],
  );
  const recipe = result.rows[0];

  if (recipe === undefined) {
    throw new Error("Generated recipe was not saved.");
  }

  return recipe;
}

async function insertIngredients(
  client: PoolClient,
  recipeId: string,
  recipe: GeneratedRecipe,
) {
  const ingredients: RecommendationCandidateIngredient[] = [];
  const seenNormalizedNames = new Set<string>();
  let displayOrder = 1;

  for (const ingredient of recipe.ingredients) {
    const normalizedName = normalizeIngredientName(ingredient.name);

    if (seenNormalizedNames.has(normalizedName)) {
      continue;
    }

    seenNormalizedNames.add(normalizedName);

    const ingredientResult = await client.query<SavedIngredientRow>(
      `INSERT INTO ingredients (name, normalized_name, aliases)
       VALUES ($1, $2, '{}')
       ON CONFLICT (normalized_name) DO UPDATE
         SET updated_at = NOW()
       RETURNING id, name, normalized_name, aliases`,
      [ingredient.name, normalizedName],
    );
    const savedIngredient = ingredientResult.rows[0];

    if (savedIngredient === undefined) {
      throw new Error(`Generated ingredient was not saved: ${ingredient.name}`);
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
        displayOrder,
      ],
    );

    ingredients.push({
      id: savedIngredient.id,
      name: savedIngredient.name,
      normalizedName: savedIngredient.normalized_name,
      aliases: savedIngredient.aliases,
    });
    displayOrder += 1;
  }

  return ingredients;
}

async function insertSteps(
  client: PoolClient,
  recipeId: string,
  recipe: GeneratedRecipe,
) {
  for (const [index, step] of recipe.steps.entries()) {
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
