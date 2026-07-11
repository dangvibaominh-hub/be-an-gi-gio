import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  validateBody,
  validateParams,
} from "../../shared/http/validate.js";
import { FeedbackController } from "./feedback.controller.js";
import {
  feedbackSessionParamsSchema,
  submitFeedbackSchema,
} from "./feedback.schemas.js";
import type { FeedbackService } from "./feedback.service.js";

export function createCookingFeedbackRouter(
  authService: AuthService,
  service: FeedbackService,
) {
  const router = Router();
  const controller = new FeedbackController(service);

  router.get(
    "/:id/feedback/options",
    authenticate(authService),
    validateParams(feedbackSessionParamsSchema),
    controller.options,
  );

  router.post(
    "/:id/feedback",
    authenticate(authService),
    validateParams(feedbackSessionParamsSchema),
    validateBody(submitFeedbackSchema),
    controller.submit,
  );

  return router;
}

export function createPersonalizationRouter(
  authService: AuthService,
  service: FeedbackService,
) {
  const router = Router();
  const controller = new FeedbackController(service);

  router.get("/", authenticate(authService), controller.personalization);

  return router;
}
