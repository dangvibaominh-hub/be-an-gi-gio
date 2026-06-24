import { AppError } from "../../shared/http/app-error.js";
import type { SavedRecipeRepository } from "./saved-recipe.repository.js";

export class SavedRecipeService {
  constructor(private readonly repository: SavedRecipeRepository) {}

  list(userId: string) {
    return this.repository.list(userId);
  }

  async save(userId: string, recipeSlug: string) {
    const savedRecipe = await this.repository.save(userId, recipeSlug);

    if (savedRecipe === null) {
      throw new AppError(
        404,
        "RECIPE_NOT_FOUND",
        "Không tìm thấy công thức này.",
      );
    }

    return savedRecipe;
  }

  async remove(userId: string, recipeSlug: string) {
    await this.repository.remove(userId, recipeSlug);
  }
}
