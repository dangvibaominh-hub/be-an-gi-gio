import type {
  FeedbackIssue,
  FeedbackIssueCounts,
  FeedbackSignal,
  PersonalizationInsightModel,
} from "./feedback.model.js";
import { emptyPersonalizationInsight } from "./feedback.model.js";

const maxSignal = 0.08;

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
        issueCounts["cutting-meat-hard"],
        feedbackCount,
      ),
      preferQuickRecipes: signalFromCount(
        issueCounts["took-longer-than-expected"],
        feedbackCount,
      ),
      preferIngredientFit: signalFromCount(
        issueCounts["missing-ingredients"],
        feedbackCount,
      ),
      preferTechniqueGuidance: signalFromCount(
        issueCounts["oil-splatter"],
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

  if (issueCounts["cutting-meat-hard"] > 0) {
    insights.push("Uu tien mon de thao tac va it so che thit.");
  }

  if (issueCounts["oil-splatter"] > 0) {
    insights.push("Giam uu tien mon chien/ngap dau de tranh ban dau.");
  }

  if (issueCounts["took-longer-than-expected"] > 0) {
    insights.push("Uu tien mon nhanh hon thoi gian du kien.");
  }

  if (issueCounts["missing-ingredients"] > 0) {
    insights.push("Tang uu tien cong thuc khop nguyen lieu dang co.");
  }

  return insights;
}

function countIssues(feedbacks: FeedbackSignal[]) {
  const counts: FeedbackIssueCounts = {
    "cutting-meat-hard": 0,
    "oil-splatter": 0,
    "took-longer-than-expected": 0,
    "missing-ingredients": 0,
  };

  for (const feedback of feedbacks) {
    for (const issue of new Set<FeedbackIssue>(feedback.issues)) {
      counts[issue] += 1;
    }
  }

  return counts;
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
