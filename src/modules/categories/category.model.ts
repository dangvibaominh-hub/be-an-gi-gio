import type { RecipeCategory } from "../recipes/recipe.model.js";

export interface CategoryModel {
  id: string;
  slug: string;
  name: RecipeCategory;
}
