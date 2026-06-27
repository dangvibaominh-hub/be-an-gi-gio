import type { AuthProvider, UserRole, UserStatus } from "../auth/auth.model.js";
import type {
  RecipeDifficulty,
  RecipeModel,
  TechniqueIcon,
} from "../recipes/recipe.model.js";

export type RecipeStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";
export type RecipeSource = "ADMIN" | "SEED" | "GEMINI";
export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminCategoryModel {
  id: string;
  slug: string;
  name: RecipeModel["category"];
}

export interface AdminRecipeAuthorModel {
  id: string;
  email: string | null;
}

export interface AdminRecipeModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  difficulty: RecipeDifficulty;
  cookTimeMinutes: number;
  baseServings: number;
  category: AdminCategoryModel;
  status: RecipeStatus;
  source: RecipeSource;
  aiModel: string | null;
  moderationStatus: ModerationStatus;
  createdBy: AdminRecipeAuthorModel | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRecipeIngredientModel {
  id: string;
  name: string;
  amount: number;
  unit: string;
  prepNote: string;
  displayOrder: number;
}

export interface AdminRecipeStepModel {
  id: string;
  displayOrder: number;
  content: string;
  estimatedMinutes: number;
  techniqueIcon: TechniqueIcon;
  isTricky: boolean;
  timerSeconds: number | null;
}

export interface AdminRecipeDetailModel extends AdminRecipeModel {
  ingredients: AdminRecipeIngredientModel[];
  steps: AdminRecipeStepModel[];
}

export interface AdminUserModel {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogModel {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: "recipe" | "user";
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedAdminResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
