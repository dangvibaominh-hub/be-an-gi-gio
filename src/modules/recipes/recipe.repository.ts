import type { Pool } from "pg";

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

export interface RecipeRepository {
  list(query: RecipeListQuery): Promise<PaginatedRecipes>;
  findBySlug(slug: string): Promise<RecipeDetailModel | null>;
}

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
