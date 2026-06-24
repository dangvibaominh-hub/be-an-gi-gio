import type { RequestHandler } from "express";

import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { CookingSessionService } from "./cooking-session.service.js";
import type {
  CookingHistoryQuery,
  StartCookingSessionInput,
  UpdateCookingSessionInput,
} from "./cooking-session.types.js";

export class CookingSessionController {
  constructor(private readonly service: CookingSessionService) {}

  start: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const input = response.locals
      .validatedBody as StartCookingSessionInput;
    const session = await this.service.start(auth.userId, input);

    response.status(201).json({ success: true, data: session });
  });

  update: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals
      .validatedBody as UpdateCookingSessionInput;
    const session = await this.service.update(auth.userId, id, input);

    response.json({ success: true, data: session });
  });

  complete: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const session = await this.service.complete(auth.userId, id);

    response.json({ success: true, data: session });
  });

  history: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const query = response.locals
      .validatedQuery as CookingHistoryQuery;
    const result = await this.service.listHistory(auth.userId, query);

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
}
