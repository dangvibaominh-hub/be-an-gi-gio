import type { UserRole, UserStatus } from "../auth/auth.model.js";
import type { RecipeDifficulty, TechniqueIcon } from "../recipes/recipe.model.js";
import type {
  ModerationStatus,
  RecipeSource,
  RecipeStatus,
} from "./admin.model.js";

export interface AdminListRecipesQuery {
  page: number;
  limit: number;
  status?: RecipeStatus;
  source?: RecipeSource;
  moderationStatus?: ModerationStatus;
}

export interface AdminRecipeIngredientInput {
  name: string;
  amount: number;
  unit: string;
  prepNote: string;
}

export interface AdminRecipeStepInput {
  content: string;
  estimatedMinutes: number;
  techniqueIcon: TechniqueIcon;
  isTricky: boolean;
  timerSeconds: number | null;
}

export interface AdminCreateRecipeInput {
  slug: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  difficulty: RecipeDifficulty;
  cookTimeMinutes: number;
  baseServings: number;
  categorySlug: string;
  status: RecipeStatus;
  ingredients: AdminRecipeIngredientInput[];
  steps: AdminRecipeStepInput[];
}

export type AdminUpdateRecipeInput = Partial<
  Omit<AdminCreateRecipeInput, "ingredients" | "steps">
> & {
  ingredients?: AdminRecipeIngredientInput[];
  steps?: AdminRecipeStepInput[];
};

export interface AdminModerateRecipeInput {
  moderationStatus: Extract<ModerationStatus, "APPROVED" | "REJECTED">;
}

export interface AdminListUsersQuery {
  page: number;
  limit: number;
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminUpdateUserStatusInput {
  status: UserStatus;
}

export interface AdminListAuditLogsQuery {
  page: number;
  limit: number;
  actorUserId?: string;
  entityType?: "recipe" | "user";
}
