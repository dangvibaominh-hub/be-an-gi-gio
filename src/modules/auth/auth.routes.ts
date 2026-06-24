import { Router } from "express";

import { validateBody } from "../../shared/http/validate.js";
import { AuthController } from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import {
  googleLoginSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(service: AuthService) {
  const router = Router();
  const controller = new AuthController(service);

  router.post("/register", validateBody(registerSchema), controller.register);
  router.post("/login", validateBody(loginSchema), controller.login);
  router.post("/google", validateBody(googleLoginSchema), controller.googleLogin);
  router.post("/refresh", validateBody(refreshTokenSchema), controller.refresh);
  router.post("/logout", validateBody(logoutSchema), controller.logout);

  return router;
}

export function createMeRouter(service: AuthService) {
  const router = Router();
  const controller = new AuthController(service);
  const authGuard = authenticate(service);

  router.get("/", authGuard, controller.me);
  router.patch(
    "/",
    authGuard,
    validateBody(updateProfileSchema),
    controller.updateMe,
  );

  return router;
}
