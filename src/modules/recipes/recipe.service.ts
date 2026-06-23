import { AppError } from "../../shared/http/app-error.js";
import type { RecipeRepository } from "./recipe.repository.js";
import type { RecipeListQuery } from "./recipe.types.js";

export class RecipeService {
  constructor(private readonly repository: RecipeRepository) {}

  list(query: RecipeListQuery) {
    return this.repository.list(query);
  }

  async getBySlug(slug: string) {
    const recipe = await this.repository.findBySlug(slug);

    if (recipe === null) {
      throw new AppError(
        404,
        "RECIPE_NOT_FOUND",
        "Không tìm thấy công thức này.",
      );
    }

    return recipe;
  }
}
