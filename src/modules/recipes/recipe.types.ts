import type {
  RecipeDifficulty,
  RecipeModel,
} from "./recipe.model.js";

export type RecipeSort =
  | "difficulty-asc"
  | "cook-time-asc"
  | "newest";

export interface RecipeListQuery {
  page: number;
  limit: number;
  category?: string;
  difficulties?: RecipeDifficulty[];
  maxCookTimeMinutes?: number;
  servings?: number;
  sort: RecipeSort;
}

export interface PaginatedRecipes {
  items: RecipeModel[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
