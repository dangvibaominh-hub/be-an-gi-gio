import { AppError } from "../../shared/http/app-error.js";
import type { AdminRepository } from "./admin.repository.js";
import type {
  AdminRecipeListQuery,
  AdminUserListQuery,
  AuditLogQuery,
  CreateRecipeInput,
  UpdateRecipeInput,
  UpdateUserStatusInput,
} from "./admin.schemas.js";

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  // ── Recipes ──────────────────────────────────────────────────────────────

  async listRecipes(query: AdminRecipeListQuery) {
    return this.repository.listRecipes(query);
  }

  async getRecipe(id: string) {
    const recipe = await this.repository.findRecipeById(id);

    if (recipe === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    return recipe;
  }

  async createRecipe(adminUserId: string, input: CreateRecipeInput) {
    return this.repository.createRecipe(adminUserId, input);
  }

  async updateRecipe(adminUserId: string, id: string, input: UpdateRecipeInput) {
    const recipe = await this.repository.updateRecipe(adminUserId, id, input);

    if (recipe === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    return recipe;
  }

  async deleteRecipe(adminUserId: string, id: string) {
    const deleted = await this.repository.softDeleteRecipe(adminUserId, id);

    if (!deleted) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }
  }

  async approveRecipe(adminUserId: string, id: string) {
    const recipe = await this.repository.findRecipeById(id);

    if (recipe === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    if (recipe.moderationStatus === "APPROVED") {
      throw new AppError(
        409,
        "RECIPE_ALREADY_APPROVED",
        "Công thức này đã được duyệt rồi.",
      );
    }

    const approved = await this.repository.approveRecipe(adminUserId, id);

    if (approved === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    return approved;
  }

  async rejectRecipe(adminUserId: string, id: string) {
    const recipe = await this.repository.findRecipeById(id);

    if (recipe === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    if (recipe.moderationStatus === "REJECTED") {
      throw new AppError(
        409,
        "RECIPE_ALREADY_REJECTED",
        "Công thức này đã bị từ chối rồi.",
      );
    }

    const rejected = await this.repository.rejectRecipe(adminUserId, id);

    if (rejected === null) {
      throw new AppError(404, "RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    }

    return rejected;
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUserListQuery) {
    return this.repository.listUsers(query);
  }

  async updateUserStatus(
    adminUserId: string,
    targetUserId: string,
    input: UpdateUserStatusInput,
  ) {
    // Admin không thể tự khóa tài khoản mình
    if (adminUserId === targetUserId) {
      throw new AppError(
        400,
        "CANNOT_MODIFY_SELF",
        "Bạn không thể thay đổi trạng thái tài khoản của chính mình.",
      );
    }

    const user = await this.repository.updateUserStatus(
      adminUserId,
      targetUserId,
      input,
    );

    if (user === null) {
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        "Không tìm thấy tài khoản người dùng.",
      );
    }

    return user;
  }

  // ── Audit logs ────────────────────────────────────────────────────────────

  async listAuditLogs(query: AuditLogQuery) {
    return this.repository.listAuditLogs(query);
  }
}
