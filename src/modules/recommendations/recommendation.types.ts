import type {
  RecipeDifficulty,
  RecipeModel,
} from "../recipes/recipe.model.js";

export type RecommendationSource = "database" | "gemini" | "empty";

export interface RecommendationFilters {
  category?: string;
  difficulties?: RecipeDifficulty[];
  maxCookTimeMinutes?: number;
  servings?: number;
}

export interface RecommendationQuery {
  ingredients: string[];
  filters: RecommendationFilters;
  page: number;
  limit: number;
}

export interface RecommendationMatch {
  score: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export interface RecipeRecommendationModel extends RecipeModel {
  match: RecommendationMatch;
}

export interface PaginatedRecommendations {
  items: RecipeRecommendationModel[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  source: RecommendationSource;
}
