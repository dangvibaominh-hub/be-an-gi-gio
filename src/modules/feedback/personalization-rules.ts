import type {
  FeedbackIssue,
  FeedbackIssueCounts,
  FeedbackSignal,
  PersonalizationInsightModel,
} from "./feedback.model.js";
import {
  emptyFeedbackIssueCounts,
  emptyPersonalizationInsight,
} from "./feedback.model.js";

const maxSignal = 0.08;
const easyRecipeIssues = [
  "cutting-meat-hard",
  "hard-to-follow-steps",
  "pan-sticking-or-burning",
  "steamed-unevenly",
  "texture-failed",
  "temperature-control-hard",
] as const satisfies readonly FeedbackIssue[];
const quickRecipeIssues = [
  "took-longer-than-expected",
] as const satisfies readonly FeedbackIssue[];
const ingredientFitIssues = [
  "missing-ingredients",
  "lacks-protein",
] as const satisfies readonly FeedbackIssue[];
const techniqueGuidanceIssues = [
  "oil-splatter",
  "too-oily",
  "not-crispy",
  "vegetables-too-soft",
  "soup-too-bland-or-salty",
  "ingredients-overcooked",
  "fishy-smell",
  "too-dry",
  "too-sweet",
  "taste-not-right",
  "bland-flavor",
] as const satisfies readonly FeedbackIssue[];

export function buildPersonalizationInsight(
  feedbacks: FeedbackSignal[],
  updatedAt: string,
): PersonalizationInsightModel {
  if (feedbacks.length === 0) {
    return emptyPersonalizationInsight();
  }

  const issueCounts = countIssues(feedbacks);
  const feedbackCount = feedbacks.length;
  const averageRating = round(
    feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) /
      feedbackCount,
    2,
  );
  const confidence = round(Math.min(1, feedbackCount / 5), 3);

  return {
    feedbackCount,
    averageRating,
    confidence,
    signals: {
      preferEasyRecipes: signalFromCount(
        sumIssueCounts(issueCounts, easyRecipeIssues),
        feedbackCount,
      ),
      preferQuickRecipes: signalFromCount(
        sumIssueCounts(issueCounts, quickRecipeIssues),
        feedbackCount,
      ),
      preferIngredientFit: signalFromCount(
        sumIssueCounts(issueCounts, ingredientFitIssues),
        feedbackCount,
      ),
      preferTechniqueGuidance: signalFromCount(
        sumIssueCounts(issueCounts, techniqueGuidanceIssues),
        feedbackCount,
      ),
    },
    issueCounts,
    insights: buildInsightMessages(issueCounts),
    updatedAt,
  };
}

export function buildInsightMessages(issueCounts: FeedbackIssueCounts) {
  const insights: string[] = [];

  if (sumIssueCounts(issueCounts, easyRecipeIssues) > 0) {
    insights.push("Uu tien cong thuc de thao tac va co buoc lam ro rang.");
  }

  if (sumIssueCounts(issueCounts, techniqueGuidanceIssues) > 0) {
    insights.push("Uu tien cong thuc co huong dan ky thuat va canh vi ro hon.");
  }

  if (sumIssueCounts(issueCounts, quickRecipeIssues) > 0) {
    insights.push("Uu tien mon nhanh hon thoi gian du kien.");
  }

  if (sumIssueCounts(issueCounts, ingredientFitIssues) > 0) {
    insights.push("Tang uu tien cong thuc khop nguyen lieu dang co.");
  }

  return insights;
}

function countIssues(feedbacks: FeedbackSignal[]) {
  const counts: FeedbackIssueCounts = emptyFeedbackIssueCounts();

  for (const feedback of feedbacks) {
    for (const issue of new Set<FeedbackIssue>(feedback.issues)) {
      counts[issue] += 1;
    }
  }

  return counts;
}

function sumIssueCounts(
  issueCounts: FeedbackIssueCounts,
  issues: readonly FeedbackIssue[],
) {
  return issues.reduce((sum, issue) => sum + issueCounts[issue], 0);
}

function signalFromCount(count: number, feedbackCount: number) {
  if (feedbackCount === 0 || count === 0) {
    return 0;
  }

  return round(Math.min(maxSignal, (count / feedbackCount) * maxSignal), 3);
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
