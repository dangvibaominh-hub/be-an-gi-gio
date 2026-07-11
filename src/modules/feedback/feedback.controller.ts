import type { RequestHandler } from "express";

import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { FeedbackService } from "./feedback.service.js";
import type { SubmitFeedbackInput } from "./feedback.types.js";

export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  options: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const options = await this.service.getOptions(auth.userId, id);

    response.json({
      success: true,
      data: options,
    });
  });

  submit: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as SubmitFeedbackInput;
    const result = await this.service.submit(auth.userId, id, input);

    response.status(201).json({
      success: true,
      data: result.feedback,
      meta: {
        personalization: result.personalization,
      },
    });
  });

  personalization: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const personalization = await this.service.getPersonalization(auth.userId);

    response.json({
      success: true,
      data: personalization,
    });
  });
}
