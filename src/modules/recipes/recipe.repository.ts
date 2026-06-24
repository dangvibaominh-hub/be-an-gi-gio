import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RecipeDetailModel,
  RecipeModel,
} from "./recipe.model.js";
import type {
  PaginatedRecipes,
  RecipeListQuery,
} from "./recipe.types.js";

interface RecipeSummaryRow {
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
}

interface RecipeIngredientRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
  prep_note: string;
}

interface RecipeStepRow {
  id: string;
  content: string;
  estimated_minutes: number;
  is_tricky: boolean;
  technique_icon: RecipeDetailModel["steps"][number]["techniqueIcon"];
  timer_seconds: number | null;
}

interface CookingTermRow {
  term: string;
  definition: string;
}

type SupabaseRecipeSummaryRow = Omit<RecipeSummaryRow, "category_name"> & {
  category: { name: RecipeModel["category"] } | null;
};

interface SupabaseCategoryIdRow {
  id: string;
}

interface SupabaseRecipeIngredientRow {
  amount: number | string;
  unit: string;
  prep_note: string;
  ingredient: Pick<RecipeIngredientRow, "id" | "name"> | null;
}

interface SupabaseCookingTermJoinRow {
  term: CookingTermRow | null;
}

export interface RecipeRepository {
  list(query: RecipeListQuery): Promise<PaginatedRecipes>;
  findBySlug(slug: string): Promise<RecipeDetailModel | null>;
}

const recipeSummarySelect = `
  id,
  slug,
  title,
  description,
  image_url,
  image_alt,
  difficulty,
  cook_time_minutes,
  base_servings,
  category:categories!inner(name)
`;

export class PostgresRecipeRepository implements RecipeRepository {
  constructor(private readonly database: Pool) {}

  async list(query: RecipeListQuery): Promise<PaginatedRecipes> {
    const values: unknown[] = [];
    const conditions = [
      "r.status = 'PUBLISHED'",
      "r.moderation_status = 'APPROVED'",
    ];

    if (query.category !== undefined) {
      values.push(query.category);
      conditions.push(
        `(c.slug = $${values.length} OR LOWER(c.name) = LOWER($${values.length}))`,
      );
    }

    if (query.difficulties !== undefined) {
      values.push(query.difficulties);
      conditions.push(`r.difficulty = ANY($${values.length}::recipe_difficulty[])`);
    }

    if (query.maxCookTimeMinutes !== undefined) {
      values.push(query.maxCookTimeMinutes);
      conditions.push(`r.cook_time_minutes <= $${values.length}`);
    }

    if (query.servings !== undefined) {
      values.push(query.servings);
      conditions.push(`r.base_servings = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");
    const sortSql = {
      "difficulty-asc":
        "array_position(ARRAY['de', 'trung-binh', 'kho']::recipe_difficulty[], r.difficulty), r.cook_time_minutes, r.title",
      "cook-time-asc": "r.cook_time_minutes, r.title",
      newest: "r.created_at DESC, r.title",
    }[query.sort];

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       WHERE ${whereClause}`,
      values,
    );

    const offset = (query.page - 1) * query.limit;
    values.push(query.limit, offset);

    const result = await this.database.query<RecipeSummaryRow>(
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
         c.name AS category_name
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       WHERE ${whereClause}
       ORDER BY ${sortSql}
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
      items: result.rows.map(mapRecipeSummary),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async findBySlug(slug: string): Promise<RecipeDetailModel | null> {
    const recipeResult = await this.database.query<RecipeSummaryRow>(
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
         c.name AS category_name
       FROM recipes r
       JOIN categories c ON c.id = r.category_id
       WHERE r.slug = $1
         AND r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
       LIMIT 1`,
      [slug],
    );

    const recipeRow = recipeResult.rows[0];
    if (recipeRow === undefined) {
      return null;
    }

    const [ingredientsResult, stepsResult, termsResult] = await Promise.all([
      this.database.query<RecipeIngredientRow>(
        `SELECT
           i.id,
           i.name,
           ri.amount,
           ri.unit,
           ri.prep_note
         FROM recipe_ingredients ri
         JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE ri.recipe_id = $1
         ORDER BY ri.display_order`,
        [recipeRow.id],
      ),
      this.database.query<RecipeStepRow>(
        `SELECT
           id,
           content,
           estimated_minutes,
           is_tricky,
           technique_icon,
           timer_seconds
         FROM recipe_steps
         WHERE recipe_id = $1
         ORDER BY display_order`,
        [recipeRow.id],
      ),
      this.database.query<CookingTermRow>(
        `SELECT DISTINCT ct.term, ct.definition
         FROM cooking_terms ct
         JOIN recipe_step_terms rst ON rst.cooking_term_id = ct.id
         JOIN recipe_steps rs ON rs.id = rst.recipe_step_id
         WHERE rs.recipe_id = $1
         ORDER BY ct.term`,
        [recipeRow.id],
      ),
    ]);

    return {
      ...mapRecipeSummary(recipeRow),
      ingredients: ingredientsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        baseAmount: Number(row.amount),
        unit: row.unit,
        prepNote: row.prep_note,
        haveIt: false,
      })),
      steps: stepsResult.rows.map((row) => ({
        id: row.id,
        content: row.content,
        estimatedMinutes: row.estimated_minutes,
        isTricky: row.is_tricky,
        techniqueIcon: row.technique_icon,
        timerSeconds: row.timer_seconds,
      })),
      cookingTerms: Object.fromEntries(
        termsResult.rows.map((row) => [row.term, row.definition]),
      ),
    };
  }
}

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly database: SupabaseClient) {}

  async list(query: RecipeListQuery): Promise<PaginatedRecipes> {
    const categoryIds = await this.findCategoryIds(query.category);

    if (query.category !== undefined && categoryIds.length === 0) {
      return emptyRecipePage(query);
    }

    let request = this.database
      .from("recipes")
      .select(recipeSummarySelect, { count: "exact" })
      .eq("status", "PUBLISHED")
      .eq("moderation_status", "APPROVED");

    if (query.category !== undefined) {
      request = request.in("category_id", categoryIds);
    }

    if (query.difficulties !== undefined) {
      request = request.in("difficulty", query.difficulties);
    }

    if (query.maxCookTimeMinutes !== undefined) {
      request = request.lte("cook_time_minutes", query.maxCookTimeMinutes);
    }

    if (query.servings !== undefined) {
      request = request.eq("base_servings", query.servings);
    }

    if (query.sort === "newest") {
      request = request
        .order("created_at", { ascending: false })
        .order("title", { ascending: true });
    } else if (query.sort === "cook-time-asc") {
      request = request
        .order("cook_time_minutes", { ascending: true })
        .order("title", { ascending: true });
    } else {
      request = request
        .order("difficulty", { ascending: true })
        .order("cook_time_minutes", { ascending: true })
        .order("title", { ascending: true });
    }

    const offset = (query.page - 1) * query.limit;
    const { data, error, count } = await request
      .range(offset, offset + query.limit - 1)
      .returns<SupabaseRecipeSummaryRow[]>();

    if (error !== null) {
      throw new Error(error.message);
    }

    const total = count ?? 0;

    return {
      items: (data ?? []).map(mapSupabaseRecipeSummary),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async findBySlug(slug: string): Promise<RecipeDetailModel | null> {
    const { data: recipeRows, error: recipeError } = await this.database
      .from("recipes")
      .select(recipeSummarySelect)
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .eq("moderation_status", "APPROVED")
      .limit(1)
      .returns<SupabaseRecipeSummaryRow[]>();

    if (recipeError !== null) {
      throw new Error(recipeError.message);
    }

    const recipeRow = recipeRows?.[0];
    if (recipeRow === undefined) {
      return null;
    }

    const [ingredientsResult, stepsResult] = await Promise.all([
      this.database
        .from("recipe_ingredients")
        .select(
          `
            amount,
            unit,
            prep_note,
            ingredient:ingredients!inner(id, name)
          `,
        )
        .eq("recipe_id", recipeRow.id)
        .order("display_order", { ascending: true })
        .returns<SupabaseRecipeIngredientRow[]>(),
      this.database
        .from("recipe_steps")
        .select(
          `
            id,
            content,
            estimated_minutes,
            is_tricky,
            technique_icon,
            timer_seconds
          `,
        )
        .eq("recipe_id", recipeRow.id)
        .order("display_order", { ascending: true })
        .returns<RecipeStepRow[]>(),
    ]);

    if (ingredientsResult.error !== null) {
      throw new Error(ingredientsResult.error.message);
    }

    if (stepsResult.error !== null) {
      throw new Error(stepsResult.error.message);
    }

    const stepIds = (stepsResult.data ?? []).map((step) => step.id);
    const cookingTerms = await this.findCookingTerms(stepIds);

    return {
      ...mapSupabaseRecipeSummary(recipeRow),
      ingredients: (ingredientsResult.data ?? []).map(mapSupabaseIngredient),
      steps: (stepsResult.data ?? []).map((row) => ({
        id: row.id,
        content: row.content,
        estimatedMinutes: row.estimated_minutes,
        isTricky: row.is_tricky,
        techniqueIcon: row.technique_icon,
        timerSeconds: row.timer_seconds,
      })),
      cookingTerms,
    };
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

  private async findCookingTerms(stepIds: string[]) {
    if (stepIds.length === 0) {
      return {};
    }

    const { data, error } = await this.database
      .from("recipe_step_terms")
      .select("term:cooking_terms!inner(term, definition)")
      .in("recipe_step_id", stepIds)
      .returns<SupabaseCookingTermJoinRow[]>();

    if (error !== null) {
      throw new Error(error.message);
    }

    return Object.fromEntries(
      (data ?? []).flatMap((row) =>
        row.term === null ? [] : [[row.term.term, row.term.definition]],
      ),
    );
  }
}

function mapRecipeSummary(row: RecipeSummaryRow): RecipeModel {
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
    category: row.category_name,
  };
}

function mapSupabaseRecipeSummary(row: SupabaseRecipeSummaryRow): RecipeModel {
  if (row.category === null) {
    throw new Error("Missing category relation in Supabase response.");
  }

  return mapRecipeSummary({
    ...row,
    category_name: row.category.name,
  });
}

function mapSupabaseIngredient(
  row: SupabaseRecipeIngredientRow,
): RecipeDetailModel["ingredients"][number] {
  if (row.ingredient === null) {
    throw new Error("Missing ingredient relation in Supabase response.");
  }

  return {
    id: row.ingredient.id,
    name: row.ingredient.name,
    baseAmount: Number(row.amount),
    unit: row.unit,
    prepNote: row.prep_note,
    haveIt: false,
  };
}

function emptyRecipePage(query: RecipeListQuery): PaginatedRecipes {
  return {
    items: [],
    page: query.page,
    limit: query.limit,
    total: 0,
    totalPages: 0,
  };
}
