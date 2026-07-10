import type { CookingSessionStatus } from "../cooking-sessions/cooking-session.model.js";
import type { RecipeCategory } from "../recipes/recipe.model.js";

export const FEEDBACK_ISSUES = [
  "cutting-meat-hard",
  "oil-splatter",
  "took-longer-than-expected",
  "missing-ingredients",
  "hard-to-follow-steps",
  "taste-not-right",
  "too-oily",
  "not-crispy",
  "pan-sticking-or-burning",
  "vegetables-too-soft",
  "soup-too-bland-or-salty",
  "ingredients-overcooked",
  "steamed-unevenly",
  "fishy-smell",
  "too-dry",
  "too-sweet",
  "texture-failed",
  "temperature-control-hard",
  "bland-flavor",
  "lacks-protein",
] as const;

export type FeedbackIssue = (typeof FEEDBACK_ISSUES)[number];

export const GENERAL_FEEDBACK_ISSUES = [
  "took-longer-than-expected",
  "missing-ingredients",
  "hard-to-follow-steps",
  "taste-not-right",
] as const satisfies readonly FeedbackIssue[];

export const FEEDBACK_ISSUES_BY_CATEGORY = {
  "Món xào": [
    "cutting-meat-hard",
    "pan-sticking-or-burning",
    "vegetables-too-soft",
    "too-oily",
  ],
  "Món canh": [
    "cutting-meat-hard",
    "soup-too-bland-or-salty",
    "ingredients-overcooked",
  ],
  "Món chiên": [
    "cutting-meat-hard",
    "oil-splatter",
    "too-oily",
    "not-crispy",
  ],
  "Món hấp": [
    "cutting-meat-hard",
    "steamed-unevenly",
    "fishy-smell",
    "too-dry",
  ],
  "Món chay": ["bland-flavor", "lacks-protein", "vegetables-too-soft"],
  "Tráng miệng": [
    "too-sweet",
    "texture-failed",
    "temperature-control-hard",
  ],
} as const satisfies Record<RecipeCategory, readonly FeedbackIssue[]>;

export function getAllowedFeedbackIssuesForCategory(category: RecipeCategory) {
  return Array.from(
    new Set<FeedbackIssue>([
      ...GENERAL_FEEDBACK_ISSUES,
      ...FEEDBACK_ISSUES_BY_CATEGORY[category],
    ]),
  );
}

export function isFeedbackIssueAllowedForCategory(
  issue: FeedbackIssue,
  category: RecipeCategory,
) {
  return getAllowedFeedbackIssuesForCategory(category).includes(issue);
}

export interface FeedbackSessionRecord {
  id: string;
  recipeId: string;
  recipeCategory: RecipeCategory;
  status: CookingSessionStatus;
}

export interface CookingFeedbackModel {
  id: string;
  cookingSessionId: string;
  recipeId: string;
  rating: number;
  issues: FeedbackIssue[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CookingFeedbackSummary {
  rating: number;
  issues: FeedbackIssue[];
  note: string | null;
  submittedAt: string;
}

export interface FeedbackSignal {
  rating: number;
  issues: FeedbackIssue[];
}

export interface PersonalizationSignals {
  preferEasyRecipes: number;
  preferQuickRecipes: number;
  preferIngredientFit: number;
  preferTechniqueGuidance: number;
}

export type FeedbackIssueCounts = Record<FeedbackIssue, number>;

export interface PersonalizationInsightModel {
  feedbackCount: number;
  averageRating: number;
  confidence: number;
  signals: PersonalizationSignals;
  issueCounts: FeedbackIssueCounts;
  insights: string[];
  updatedAt: string | null;
}

export function emptyPersonalizationInsight(): PersonalizationInsightModel {
  return {
    feedbackCount: 0,
    averageRating: 0,
    confidence: 0,
    signals: {
      preferEasyRecipes: 0,
      preferQuickRecipes: 0,
      preferIngredientFit: 0,
      preferTechniqueGuidance: 0,
    },
    issueCounts: emptyFeedbackIssueCounts(),
    insights: [],
    updatedAt: null,
  };
}

export function emptyFeedbackIssueCounts(): FeedbackIssueCounts {
  return Object.fromEntries(
    FEEDBACK_ISSUES.map((issue) => [issue, 0]),
  ) as FeedbackIssueCounts;
}
