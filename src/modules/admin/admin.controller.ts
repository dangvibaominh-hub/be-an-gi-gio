import type { RequestHandler } from "express";

import { requireAuthenticatedUser } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import type { AdminService } from "./admin.service.js";
import type {
  AdminCreateRecipeInput,
  AdminListAuditLogsQuery,
  AdminListRecipesQuery,
  AdminListUsersQuery,
  AdminModerateRecipeInput,
  AdminUpdateRecipeInput,
  AdminUpdateUserStatusInput,
} from "./admin.types.js";

export class AdminController {
  constructor(private readonly service: AdminService) {}

  listRecipes: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AdminListRecipesQuery;
    const result = await this.service.listRecipes(query);

    response.json(toPaginatedResponse(result));
  });

  getRecipe: RequestHandler = asyncHandler(async (_request, response) => {
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.getRecipe(id);

    response.json({ success: true, data: recipe });
  });

  createRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const input = response.locals.validatedBody as AdminCreateRecipeInput;
    const recipe = await this.service.createRecipe(actor, input);

    response.status(201).json({ success: true, data: recipe });
  });

  updateRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as AdminUpdateRecipeInput;
    const recipe = await this.service.updateRecipe(actor, id, input);

    response.json({ success: true, data: recipe });
  });

  hideRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    await this.service.hideRecipe(actor, id);

    response.status(204).send();
  });

  moderateRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as AdminModerateRecipeInput;
    const recipe = await this.service.moderateRecipe(actor, id, input);

    response.json({ success: true, data: recipe });
  });

  approveRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.moderateRecipe(actor, id, {
      moderationStatus: "APPROVED",
    });

    response.json({ success: true, data: recipe });
  });

  rejectRecipe: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const recipe = await this.service.moderateRecipe(actor, id, {
      moderationStatus: "REJECTED",
    });

    response.json({ success: true, data: recipe });
  });

  listUsers: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AdminListUsersQuery;
    const result = await this.service.listUsers(query);

    response.json(toPaginatedResponse(result));
  });

  updateUserStatus: RequestHandler = asyncHandler(async (request, response) => {
    const actor = requireAuthenticatedUser(request);
    const { id } = response.locals.validatedParams as { id: string };
    const input = response.locals.validatedBody as AdminUpdateUserStatusInput;
    const user = await this.service.updateUserStatus(actor, id, input);

    response.json({ success: true, data: user });
  });

  listAuditLogs: RequestHandler = asyncHandler(async (_request, response) => {
    const query = response.locals.validatedQuery as AdminListAuditLogsQuery;
    const result = await this.service.listAuditLogs(query);

    response.json(toPaginatedResponse(result));
  });
}

function toPaginatedResponse<T>(result: {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}) {
  return {
    success: true,
    data: result.items,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  };
}
