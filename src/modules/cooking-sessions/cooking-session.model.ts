import type { RecipeModel } from "../recipes/recipe.model.js";

export type CookingSessionStatus = "IN_PROGRESS" | "COMPLETED";

export interface CookingSessionModel {
  id: string;
  recipe: RecipeModel;
  currentStep: number;
  totalSteps: number;
  servings: number;
  status: CookingSessionStatus;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface PaginatedCookingSessions {
  items: CookingSessionModel[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
