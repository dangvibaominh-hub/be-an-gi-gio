import { Router } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../shared/http/validate.js";
import type { AuthService } from "../auth/auth.service.js";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import { AdminController } from "./admin.controller.js";
import type { AdminRepository } from "./admin.repository.js";
import {
  adminCreateRecipeSchema,
  adminListAuditLogsQuerySchema,
  adminListRecipesQuerySchema,
  adminListUsersQuerySchema,
  adminModerateRecipeSchema,
  adminRecipeIdParamsSchema,
  adminUpdateRecipeSchema,
  adminUpdateUserStatusSchema,
  adminUserIdParamsSchema,
} from "./admin.schemas.js";
import { AdminService } from "./admin.service.js";
import type { RecipeImageStorage } from "./admin-upload.js";
import {
  createRecipeMultipartBodyParser,
  rejectJsonRecipeImageUrl,
  requireMultipartRecipeImageUpload,
} from "./admin-upload.js";

export function createAdminRouter(
  authService: AuthService,
  adminRepository: AdminRepository,
  recipeImageStorage: RecipeImageStorage,
) {
  const router = Router();
  const controller = new AdminController(new AdminService(adminRepository));
  const adminGuard = [authenticate(authService), requireRole("ADMIN")];
  const parseCreateRecipeMultipart = createRecipeMultipartBodyParser(
    recipeImageStorage,
    { requireImage: true },
  );
  const parseUpdateRecipeMultipart = createRecipeMultipartBodyParser(
    recipeImageStorage,
  );

  router.use(adminGuard);

  router.get(
    "/recipes",
    validateQuery(adminListRecipesQuerySchema),
    controller.listRecipes,
  );
  router.post(
    "/recipes",
    requireMultipartRecipeImageUpload,
    parseCreateRecipeMultipart,
    validateBody(adminCreateRecipeSchema),
    controller.createRecipe,
  );
  router.get(
    "/recipes/:id",
    validateParams(adminRecipeIdParamsSchema),
    controller.getRecipe,
  );
  router.patch(
    "/recipes/:id",
    validateParams(adminRecipeIdParamsSchema),
    parseUpdateRecipeMultipart,
    rejectJsonRecipeImageUrl,
    validateBody(adminUpdateRecipeSchema),
    controller.updateRecipe,
  );
  router.delete(
    "/recipes/:id",
    validateParams(adminRecipeIdParamsSchema),
    controller.hideRecipe,
  );
  router.post(
    "/recipes/:id/approve",
    validateParams(adminRecipeIdParamsSchema),
    controller.approveRecipe,
  );
  router.post(
    "/recipes/:id/reject",
    validateParams(adminRecipeIdParamsSchema),
    controller.rejectRecipe,
  );
  router.patch(
    "/recipes/:id/moderation",
    validateParams(adminRecipeIdParamsSchema),
    validateBody(adminModerateRecipeSchema),
    controller.moderateRecipe,
  );
  router.get(
    "/users",
    validateQuery(adminListUsersQuerySchema),
    controller.listUsers,
  );
  router.patch(
    "/users/:id/status",
    validateParams(adminUserIdParamsSchema),
    validateBody(adminUpdateUserStatusSchema),
    controller.updateUserStatus,
  );
  router.get(
    "/audit-logs",
    validateQuery(adminListAuditLogsQuerySchema),
    controller.listAuditLogs,
  );

  return router;
}
