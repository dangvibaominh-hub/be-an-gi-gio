import type { RequestHandler } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import type { RecipeService } from "./recipe.service.js";
import type { RecipeListQuery } from "./recipe.types.js";

export class RecipeController {
  constructor(private readonly service: RecipeService) {}

  list: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as RecipeListQuery;
    const result = await this.service.list(query);

    response.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  });

  getBySlug: RequestHandler = asyncHandler(async (_request, response) => {
    const { slug } = response.locals.validatedParams as { slug: string };
    const recipe = await this.service.getBySlug(slug);
    response.json({ success: true, data: recipe });
  });
}
