import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { validateParams } from "../../shared/http/validate.js";
import { SavedRecipeController } from "./saved-recipe.controller.js";
import { savedRecipeSlugParamsSchema } from "./saved-recipe.schemas.js";
import type { SavedRecipeService } from "./saved-recipe.service.js";

export function createSavedRecipeRouter(
  authService: AuthService,
  service: SavedRecipeService,
) {
  const router = Router();
  const controller = new SavedRecipeController(service);
  const authGuard = authenticate(authService);

  router.get("/", authGuard, controller.list);
  router.post(
    "/:slug",
    authGuard,
    validateParams(savedRecipeSlugParamsSchema),
    controller.save,
  );
  router.delete(
    "/:slug",
    authGuard,
    validateParams(savedRecipeSlugParamsSchema),
    controller.remove,
  );

  return router;
}
