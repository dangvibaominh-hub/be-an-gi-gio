import { Router } from "express";

import { optionalAuthenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { validateBody } from "../../shared/http/validate.js";
import { RecommendationController } from "./recommendation.controller.js";
import { recommendationRequestSchema } from "./recommendation.schemas.js";
import type { RecommendationService } from "./recommendation.service.js";

export function createRecommendationRouter(
  service: RecommendationService,
  authService?: AuthService,
) {
  const router = Router();
  const controller = new RecommendationController(service);
  const authGuard =
    authService === undefined ? [] : [optionalAuthenticate(authService)];

  router.post(
    "/",
    ...authGuard,
    validateBody(recommendationRequestSchema),
    controller.recommend,
  );

  return router;
}
