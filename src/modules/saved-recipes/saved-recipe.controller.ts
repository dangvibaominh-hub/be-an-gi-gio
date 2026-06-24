import type { RequestHandler } from "express";

import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { SavedRecipeService } from "./saved-recipe.service.js";

export class SavedRecipeController {
  constructor(private readonly service: SavedRecipeService) {}

  list: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const savedRecipes = await this.service.list(auth.userId);
    response.json({ success: true, data: savedRecipes });
  });

  save: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { slug } = response.locals.validatedParams as { slug: string };
    const savedRecipe = await this.service.save(auth.userId, slug);
    response.status(201).json({ success: true, data: savedRecipe });
  });

  remove: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { slug } = response.locals.validatedParams as { slug: string };
    await this.service.remove(auth.userId, slug);
    response.status(204).send();
  });
}
