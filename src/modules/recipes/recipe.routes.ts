import { Router } from "express";

import {
  validateParams,
  validateQuery,
} from "../../shared/http/validate.js";
import { RecipeController } from "./recipe.controller.js";
import {
  recipeListQuerySchema,
  recipeSlugParamsSchema,
} from "./recipe.schemas.js";
import type { RecipeService } from "./recipe.service.js";

export function createRecipeRouter(service: RecipeService) {
  const router = Router();
  const controller = new RecipeController(service);

  router.get(
    "/",
    validateQuery(recipeListQuerySchema),
    controller.list,
  );

  router.get(
    "/:slug",
    validateParams(recipeSlugParamsSchema),
    controller.getBySlug,
  );

  return router;
}
