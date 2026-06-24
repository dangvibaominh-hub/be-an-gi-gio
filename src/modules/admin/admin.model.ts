export type RecipeStatus = "PUBLISHED" | "HIDDEN";
export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RecipeSource = "ADMIN" | "SEED" | "GEMINI";
export type UserStatus = "ACTIVE" | "BLOCKED";
export type UserRole = "USER" | "ADMIN";

export interface AdminRecipeSummaryModel {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  cookTimeMinutes: number;
  baseServings: number;
  category: string;
  status: RecipeStatus;
  source: RecipeSource;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRecipeDetailModel extends AdminRecipeSummaryModel {
  description: string;
  image: string;
  imageAlt: string;
}

export interface AdminUserModel {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuditLogModel {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
