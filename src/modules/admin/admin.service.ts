import { AppError } from "../../shared/http/app-error.js";
import type { AuthenticatedRequestUser } from "../auth/auth.middleware.js";
import type { RecipeStatus } from "./admin.model.js";
import type { AdminRepository } from "./admin.repository.js";
import type {
  AdminCreateRecipeInput,
  AdminListAuditLogsQuery,
  AdminListRecipesQuery,
  AdminListUsersQuery,
  AdminModerateRecipeInput,
  AdminUpdateRecipeInput,
  AdminUpdateUserStatusInput,
} from "./admin.types.js";

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  listRecipes(query: AdminListRecipesQuery) {
    return this.repository.listRecipes(query);
  }

  async getRecipe(recipeId: string) {
    const recipe = await this.repository.findRecipeById(recipeId);

    if (recipe === null) {
      throw new AppError(404, "ADMIN_RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    return recipe;
  }

  async createRecipe(actor: AuthenticatedRequestUser, input: AdminCreateRecipeInput) {
    const recipe = await this.executeRecipeMutation(() =>
      this.repository.createRecipe(input, actor.userId),
    );

    await this.audit(actor.userId, "RECIPE_CREATED", "recipe", recipe.id, {
      slug: recipe.slug,
      status: recipe.status,
    });

    return recipe;
  }

  async updateRecipe(
    actor: AuthenticatedRequestUser,
    recipeId: string,
    input: AdminUpdateRecipeInput,
  ) {
    const recipe = await this.executeRecipeMutation(() =>
      this.repository.updateRecipe(recipeId, input),
    );

    if (recipe === null) {
      throw new AppError(404, "ADMIN_RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    await this.audit(actor.userId, "RECIPE_UPDATED", "recipe", recipe.id, {
      slug: recipe.slug,
      changedFields: Object.keys(input),
    });

    return recipe;
  }

  async hideRecipe(actor: AuthenticatedRequestUser, recipeId: string) {
    const recipe = await this.repository.setRecipeStatus(recipeId, "HIDDEN");

    if (recipe === null) {
      throw new AppError(404, "ADMIN_RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    await this.audit(actor.userId, "RECIPE_HIDDEN", "recipe", recipe.id, {
      slug: recipe.slug,
    });
  }

  async moderateRecipe(
    actor: AuthenticatedRequestUser,
    recipeId: string,
    input: AdminModerateRecipeInput,
  ) {
    const currentRecipe = await this.getRecipe(recipeId);

    if (currentRecipe.source !== "GEMINI") {
      throw new AppError(
        409,
        "RECIPE_NOT_AI_GENERATED",
        "Chỉ công thức do Gemini tạo mới cần kiểm duyệt.",
      );
    }

    const nextStatus: RecipeStatus =
      input.moderationStatus === "APPROVED" ? "PUBLISHED" : "HIDDEN";
    const recipe = await this.repository.setRecipeModeration(
      recipeId,
      input.moderationStatus,
      nextStatus,
    );

    if (recipe === null) {
      throw new AppError(404, "ADMIN_RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    await this.audit(
      actor.userId,
      input.moderationStatus === "APPROVED"
        ? "RECIPE_APPROVED"
        : "RECIPE_REJECTED",
      "recipe",
      recipe.id,
      {
        slug: recipe.slug,
        previousModerationStatus: currentRecipe.moderationStatus,
        moderationStatus: recipe.moderationStatus,
        status: recipe.status,
      },
    );

    return recipe;
  }

  listUsers(query: AdminListUsersQuery) {
    return this.repository.listUsers(query);
  }

  async updateUserStatus(
    actor: AuthenticatedRequestUser,
    userId: string,
    input: AdminUpdateUserStatusInput,
  ) {
    if (actor.userId === userId && input.status === "SUSPENDED") {
      throw new AppError(
        409,
        "SELF_SUSPEND_NOT_ALLOWED",
        "Admin không thể tự khóa tài khoản đang dùng.",
      );
    }

    const user = await this.repository.updateUserStatus(userId, input.status);

    if (user === null) {
      throw new AppError(404, "ADMIN_USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    }

    if (input.status === "SUSPENDED") {
      await this.repository.revokeUserRefreshTokens(userId);
    }

    await this.audit(actor.userId, "USER_STATUS_UPDATED", "user", user.id, {
      email: user.email,
      status: user.status,
    });

    return user;
  }

  listAuditLogs(query: AdminListAuditLogsQuery) {
    return this.repository.listAuditLogs(query);
  }

  private async executeRecipeMutation<T>(
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          "RECIPE_SLUG_ALREADY_EXISTS",
          "Slug công thức đã tồn tại.",
        );
      }

      if (isCategoryNotFound(error)) {
        throw new AppError(
          404,
          "CATEGORY_NOT_FOUND",
          "Không tìm thấy danh mục công thức.",
        );
      }

      throw error;
    }
  }

  private audit(
    actorUserId: string,
    action: string,
    entityType: "recipe" | "user",
    entityId: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.repository.createAuditLog({
      actorUserId,
      action,
      entityType,
      entityId,
      ...(details === undefined ? {} : { details }),
    });
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function isCategoryNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "CATEGORY_NOT_FOUND"
  );
}
