import type { Pool } from "pg";

import type { RecipeModel } from "../recipes/recipe.model.js";
import type { SavedRecipeModel } from "./saved-recipe.model.js";

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
  category_name: RecipeModel["category"];
  saved_at: Date;
}

export interface SavedRecipeRepository {
  list(userId: string): Promise<SavedRecipeModel[]>;
  save(userId: string, recipeSlug: string): Promise<SavedRecipeModel | null>;
  remove(userId: string, recipeSlug: string): Promise<boolean>;
}

export class PostgresSavedRecipeRepository implements SavedRecipeRepository {
  constructor(private readonly database: Pool) {}

  async list(userId: string) {
    const result = await this.database.query<SavedRecipeRow>(
      `${savedRecipeSelect}
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC`,
      [userId],
    );

    return result.rows.map(mapSavedRecipeRow);
  }

  async save(userId: string, recipeSlug: string) {
    await this.database.query(
      `INSERT INTO saved_recipes (user_id, recipe_id)
       SELECT $1, r.id
       FROM recipes r
       WHERE r.slug = $2
         AND r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
       ON CONFLICT DO NOTHING`,
      [userId, recipeSlug],
    );

    const result = await this.database.query<SavedRecipeRow>(
      `${savedRecipeSelect}
       WHERE sr.user_id = $1
         AND r.slug = $2
       LIMIT 1`,
      [userId, recipeSlug],
    );

    return result.rows[0] === undefined
      ? null
      : mapSavedRecipeRow(result.rows[0]);
  }

  async remove(userId: string, recipeSlug: string) {
    const result = await this.database.query(
      `DELETE FROM saved_recipes sr
       USING recipes r
       WHERE sr.recipe_id = r.id
         AND sr.user_id = $1
         AND r.slug = $2`,
      [userId, recipeSlug],
    );

    return (result.rowCount ?? 0) > 0;
  }
}

const savedRecipeSelect = `
  SELECT
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
    sr.created_at AS saved_at
  FROM saved_recipes sr
  JOIN recipes r ON r.id = sr.recipe_id
  JOIN categories c ON c.id = r.category_id
`;

function mapSavedRecipeRow(row: SavedRecipeRow): SavedRecipeModel {
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
    savedAt: row.saved_at.toISOString(),
  };
}
