import { Router } from "express";

import { authenticate } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../shared/http/validate.js";
import { CookingSessionController } from "./cooking-session.controller.js";
import {
  cookingHistoryQuerySchema,
  cookingSessionIdParamsSchema,
  startCookingSessionSchema,
  updateCookingSessionSchema,
} from "./cooking-session.schemas.js";
import type { CookingSessionService } from "./cooking-session.service.js";

export function createCookingSessionRouter(
  authService: AuthService,
  service: CookingSessionService,
) {
  const router = Router();
  const controller = new CookingSessionController(service);
  const authGuard = authenticate(authService);

  router.post(
    "/",
    authGuard,
    validateBody(startCookingSessionSchema),
    controller.start,
  );
  router.patch(
    "/:id",
    authGuard,
    validateParams(cookingSessionIdParamsSchema),
    validateBody(updateCookingSessionSchema),
    controller.update,
  );
  router.post(
    "/:id/complete",
    authGuard,
    validateParams(cookingSessionIdParamsSchema),
    controller.complete,
  );

  return router;
}

export function createCookingHistoryRouter(
  authService: AuthService,
  service: CookingSessionService,
) {
  const router = Router();
  const controller = new CookingSessionController(service);

  router.get(
    "/",
    authenticate(authService),
    validateQuery(cookingHistoryQuerySchema),
    controller.history,
  );

  return router;
}
