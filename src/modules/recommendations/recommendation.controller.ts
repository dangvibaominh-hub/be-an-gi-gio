import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { RecommendationService } from "./recommendation.service.js";
import type { RecommendationQuery } from "./recommendation.types.js";

export class RecommendationController {
  constructor(private readonly service: RecommendationService) {}

  recommend: RequestHandler = asyncHandler(async (request, response) => {
    const auth = getAuthenticatedUser(request);
    const query = response.locals.validatedBody as RecommendationQuery;
    const result = await this.service.recommend(query, auth?.userId);

    response.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        source: result.source,
      },
    });
  });
}
