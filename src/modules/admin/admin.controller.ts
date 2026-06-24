import type { RequestHandler } from "express";

import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { AdminService } from "./admin.service.js";
import type {
  AdminRecipeListQuery,
  AdminUserListQuery,
  AuditLogQuery,
  CreateRecipeInput,
  UpdateRecipeInput,
  UpdateUserStatusInput,
} from "./admin.schemas.js";

export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ── Recipes ──────────────────────────────────────────────────────────────

  listRecipes: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AdminRecipeListQuery;
    const result = await this.service.listRecipes(query);

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

  getRecipe: RequestHandler = asyncHandler(async (_request, response) => {
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.getRecipe(id);

    response.json({ success: true, data: recipe });
  });

  createRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const input = response.locals.validatedBody as CreateRecipeInput;
    const recipe = await this.service.createRecipe(auth.userId, input);

    response.status(201).json({ success: true, data: recipe });
  });

  updateRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as UpdateRecipeInput;
    const recipe = await this.service.updateRecipe(auth.userId, id, input);

    response.json({ success: true, data: recipe });
  });

  deleteRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    await this.service.deleteRecipe(auth.userId, id);

    response.status(204).send();
  });

  approveRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.approveRecipe(auth.userId, id);

    response.json({ success: true, data: recipe });
  });

  rejectRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.rejectRecipe(auth.userId, id);

    response.json({ success: true, data: recipe });
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  listUsers: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AdminUserListQuery;
    const result = await this.service.listUsers(query);

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

  updateUserStatus: RequestHandler = asyncHandler(
    async (request, response) => {
      const auth = requireAuthenticatedUser(request);
      const { id } = response.locals.validatedParams as { id: string };
      const input = response.locals.validatedBody as UpdateUserStatusInput;
      const user = await this.service.updateUserStatus(auth.userId, id, input);

      response.json({ success: true, data: user });
    },
  );

  // ── Audit logs ────────────────────────────────────────────────────────────

  listAuditLogs: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AuditLogQuery;
    const result = await this.service.listAuditLogs(query);

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
