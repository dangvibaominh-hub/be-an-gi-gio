import { Router } from "express";

import {
  authenticate,
  requireRole,
} from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../shared/http/validate.js";
import { AdminController } from "./admin.controller.js";
import {
  adminRecipeIdParamsSchema,
  adminRecipeListQuerySchema,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  auditLogQuerySchema,
  createRecipeSchema,
  updateRecipeSchema,
  updateUserStatusSchema,
} from "./admin.schemas.js";
import type { AdminService } from "./admin.service.js";

export function createAdminRouter(
  authService: AuthService,
  service: AdminService,
) {
  const router = Router();
  const controller = new AdminController(service);

  // Mọi route trong /api/v1/admin đều yêu cầu JWT hợp lệ + role ADMIN
  const adminGuard = [authenticate(authService), requireRole("ADMIN")];

  // ── Recipes ─────────────────────────────────────────────────────────────
  router.get(
    "/recipes",
    ...adminGuard,
    validateQuery(adminRecipeListQuerySchema),
    controller.listRecipes,
  );

  router.post(
    "/recipes",
    ...adminGuard,
    validateBody(createRecipeSchema),
    controller.createRecipe,
  );

  router.get(
    "/recipes/:id",
    ...adminGuard,
    validateParams(adminRecipeIdParamsSchema),
    controller.getRecipe,
  );

  router.patch(
    "/recipes/:id",
    ...adminGuard,
    validateParams(adminRecipeIdParamsSchema),
    validateBody(updateRecipeSchema),
    controller.updateRecipe,
  );

  router.delete(
    "/recipes/:id",
    ...adminGuard,
    validateParams(adminRecipeIdParamsSchema),
    controller.deleteRecipe,
  );

  router.post(
    "/recipes/:id/approve",
    ...adminGuard,
    validateParams(adminRecipeIdParamsSchema),
    controller.approveRecipe,
  );

  router.post(
    "/recipes/:id/reject",
    ...adminGuard,
    validateParams(adminRecipeIdParamsSchema),
    controller.rejectRecipe,
  );

  // ── Users ────────────────────────────────────────────────────────────────
  router.get(
    "/users",
    ...adminGuard,
    validateQuery(adminUserListQuerySchema),
    controller.listUsers,
  );

  router.patch(
    "/users/:id/status",
    ...adminGuard,
    validateParams(adminUserIdParamsSchema),
    validateBody(updateUserStatusSchema),
    controller.updateUserStatus,
  );

  // ── Audit logs ────────────────────────────────────────────────────────────
  router.get(
    "/audit-logs",
    ...adminGuard,
    validateQuery(auditLogQuerySchema),
    controller.listAuditLogs,
  );

  return router;
}
