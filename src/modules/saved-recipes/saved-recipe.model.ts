import type { RecipeModel } from "../recipes/recipe.model.js";

export interface SavedRecipeModel extends RecipeModel {
  savedAt: string;
}
