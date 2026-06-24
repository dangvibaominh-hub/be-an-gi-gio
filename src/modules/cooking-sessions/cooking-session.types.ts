export interface StartCookingSessionInput {
  recipeSlug: string;
  servings?: number;
}

export interface UpdateCookingSessionInput {
  currentStep?: number;
  servings?: number;
}

export type CookingHistorySort =
  | "completed-at-desc"
  | "started-at-desc"
  | "rating-desc";

export interface CookingHistoryQuery {
  page: number;
  limit: number;
  sort: CookingHistorySort;
}
