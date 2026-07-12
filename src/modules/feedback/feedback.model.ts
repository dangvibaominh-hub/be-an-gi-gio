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

const feedbackIssueSet = new Set<string>(FEEDBACK_ISSUES);

export function normalizeFeedbackIssues(value: unknown): FeedbackIssue[] {
  const rawIssues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? parsePostgresTextArray(value)
      : [];

  return Array.from(
    new Set(
      rawIssues.filter(
        (issue): issue is FeedbackIssue =>
          typeof issue === "string" && feedbackIssueSet.has(issue),
      ),
    ),
  );
}

export const GENERAL_FEEDBACK_ISSUES = [
  "took-longer-than-expected",
  "missing-ingredients",
  "hard-to-follow-steps",
  "taste-not-right",
] as const satisfies readonly FeedbackIssue[];

export const FEEDBACK_ISSUE_LABELS = {
  "cutting-meat-hard": "Cắt thịt khó quá",
  "oil-splatter": "Chiên bị bắn dầu",
  "took-longer-than-expected": "Mất nhiều thời gian hơn dự kiến",
  "missing-ingredients": "Thiếu nguyên liệu",
  "hard-to-follow-steps": "Các bước hơi khó theo",
  "taste-not-right": "Vị chưa đúng ý",
  "too-oily": "Món bị nhiều dầu",
  "not-crispy": "Chiên chưa giòn",
  "pan-sticking-or-burning": "Bị dính hoặc cháy chảo",
  "vegetables-too-soft": "Rau bị mềm quá",
  "soup-too-bland-or-salty": "Canh nhạt hoặc mặn",
  "ingredients-overcooked": "Nguyên liệu bị quá chín",
  "steamed-unevenly": "Hấp chưa chín đều",
  "fishy-smell": "Còn mùi tanh",
  "too-dry": "Món bị khô",
  "too-sweet": "Quá ngọt",
  "texture-failed": "Kết cấu chưa đạt",
  "temperature-control-hard": "Khó canh nhiệt",
  "bland-flavor": "Vị hơi nhạt",
  "lacks-protein": "Thiếu đạm",
} as const satisfies Record<FeedbackIssue, string>;

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
      ...FEEDBACK_ISSUES_BY_CATEGORY[category],
      ...GENERAL_FEEDBACK_ISSUES,
    ]),
  );
}

export function getAllowedFeedbackIssueOptionsForCategory(
  category: RecipeCategory,
) {
  return getAllowedFeedbackIssuesForCategory(category).map((issue) => ({
    value: issue,
    label: FEEDBACK_ISSUE_LABELS[issue],
  }));
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

export interface FeedbackIssueOption {
  value: FeedbackIssue;
  label: string;
}

export interface FeedbackOptionsModel {
  cookingSessionId: string;
  recipeId: string;
  recipeCategory: RecipeCategory;
  issues: FeedbackIssueOption[];
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

function parsePostgresTextArray(value: string) {
  if (!value.startsWith("{") || !value.endsWith("}")) {
    return [];
  }

  const values: string[] = [];
  const content = value.slice(1, -1);
  let current = "";
  let inQuotes = false;
  let escaping = false;

  for (const character of content) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      if (current.length > 0) {
        values.push(current);
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0) {
    values.push(current);
  }

  return values;
}
