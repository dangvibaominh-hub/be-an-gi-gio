export const RECIPE_CATEGORIES = [
  "Món xào",
  "Món canh",
  "Món chiên",
  "Món hấp",
  "Món chay",
  "Tráng miệng",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
export type RecipeDifficulty = "de" | "trung-binh" | "kho";
export type TechniqueIcon = "dao" | "chao" | "noi" | "tron" | "hap";

export interface RecipeIngredientModel {
  id: string;
  name: string;
  baseAmount: number;
  unit: string;
  prepNote: string;
  haveIt: boolean;
}

export interface RecipeStepModel {
  id: string;
  content: string;
  estimatedMinutes: number;
  isTricky: boolean;
  techniqueIcon: TechniqueIcon;
  timerSeconds: number | null;
}

export interface RecipeModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  difficulty: RecipeDifficulty;
  cookTimeMinutes: number;
  baseServings: number;
  category: RecipeCategory;
}

export interface RecipeDetailModel extends RecipeModel {
  ingredients: RecipeIngredientModel[];
  steps: RecipeStepModel[];
  cookingTerms: Record<string, string>;
}
