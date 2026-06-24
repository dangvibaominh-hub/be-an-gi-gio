import type { CookingSessionStatus } from "../cooking-sessions/cooking-session.model.js";

export const FEEDBACK_ISSUES = [
  "cutting-meat-hard",
  "oil-splatter",
  "took-longer-than-expected",
  "missing-ingredients",
] as const;

export type FeedbackIssue = (typeof FEEDBACK_ISSUES)[number];

export interface FeedbackSessionRecord {
  id: string;
  recipeId: string;
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
    issueCounts: {
      "cutting-meat-hard": 0,
      "oil-splatter": 0,
      "took-longer-than-expected": 0,
      "missing-ingredients": 0,
    },
    insights: [],
    updatedAt: null,
  };
}
