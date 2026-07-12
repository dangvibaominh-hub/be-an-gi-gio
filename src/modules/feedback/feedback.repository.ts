import type { Pool } from "pg";

import type { CookingSessionStatus } from "../cooking-sessions/cooking-session.model.js";
import type { RecipeCategory } from "../recipes/recipe.model.js";
import type {
  CookingFeedbackModel,
  FeedbackIssue,
  FeedbackIssueCounts,
  FeedbackSessionRecord,
  FeedbackSignal,
  PersonalizationInsightModel,
} from "./feedback.model.js";
import {
  buildInsightMessages,
} from "./personalization-rules.js";
import type { SubmitFeedbackInput } from "./feedback.types.js";
import {
  emptyFeedbackIssueCounts,
  emptyPersonalizationInsight,
  normalizeFeedbackIssues,
} from "./feedback.model.js";

interface FeedbackSessionRow {
  id: string;
  recipe_id: string;
  category_name: RecipeCategory;
  status: CookingSessionStatus;
}

interface FeedbackRow {
  id: string;
  cooking_session_id: string;
  recipe_id: string;
  rating: number;
  issues: unknown;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FeedbackSignalRow {
  rating: number;
  issues: unknown;
}

interface PersonalizationRow {
  feedback_count: number;
  average_rating: string;
  confidence: string;
  easy_recipe_boost: string;
  quick_recipe_boost: string;
  ingredient_match_boost: string;
  technique_guidance_boost: string;
  cutting_meat_hard_count: number;
  oil_splatter_count: number;
  took_longer_than_expected_count: number;
  missing_ingredients_count: number;
  issue_counts: unknown;
  updated_at: Date;
}

export interface PersonalizationRepository {
  getInsight(userId: string): Promise<PersonalizationInsightModel>;
}

export interface FeedbackRepository extends PersonalizationRepository {
  findSessionForFeedback(
    userId: string,
    cookingSessionId: string,
  ): Promise<FeedbackSessionRecord | null>;
  upsertFeedback(
    userId: string,
    session: FeedbackSessionRecord,
    input: SubmitFeedbackInput,
  ): Promise<CookingFeedbackModel>;
  listFeedbackSignals(userId: string): Promise<FeedbackSignal[]>;
  saveInsight(
    userId: string,
    insight: PersonalizationInsightModel,
  ): Promise<PersonalizationInsightModel>;
}

export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly database: Pool) {}

  async findSessionForFeedback(userId: string, cookingSessionId: string) {
    const result = await this.database.query<FeedbackSessionRow>(
      `SELECT
         cs.id,
         cs.recipe_id,
         cs.status,
         c.name AS category_name
       FROM cooking_sessions cs
       JOIN recipes r ON r.id = cs.recipe_id
       JOIN categories c ON c.id = r.category_id
       WHERE cs.user_id = $1
         AND cs.id = $2
       LIMIT 1`,
      [userId, cookingSessionId],
    );
    const session = result.rows[0];

    if (session === undefined) {
      return null;
    }

    return {
      id: session.id,
      recipeId: session.recipe_id,
      recipeCategory: session.category_name,
      status: session.status,
    };
  }

  async upsertFeedback(
    userId: string,
    session: FeedbackSessionRecord,
    input: SubmitFeedbackInput,
  ) {
    const result = await this.database.query<FeedbackRow>(
      `INSERT INTO cooking_feedback (
         user_id,
         cooking_session_id,
         recipe_id,
         rating,
         issues,
         note
       )
       VALUES ($1, $2, $3, $4, $5::feedback_issue[], $6)
       ON CONFLICT (cooking_session_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         issues = EXCLUDED.issues,
         note = EXCLUDED.note,
         updated_at = NOW()
       RETURNING
         id,
         cooking_session_id,
         recipe_id,
         rating,
         issues,
         note,
         created_at,
         updated_at`,
      [
        userId,
        session.id,
        session.recipeId,
        input.rating,
        input.issues,
        input.note ?? null,
      ],
    );
    const feedback = result.rows[0];

    if (feedback === undefined) {
      throw new Error("Feedback was not saved.");
    }

    return mapFeedbackRow(feedback);
  }

  async listFeedbackSignals(userId: string) {
    const result = await this.database.query<FeedbackSignalRow>(
      `SELECT rating, issues
       FROM cooking_feedback
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      rating: row.rating,
      issues: normalizeFeedbackIssues(row.issues),
    }));
  }

  async saveInsight(userId: string, insight: PersonalizationInsightModel) {
    const result = await this.database.query<PersonalizationRow>(
      `INSERT INTO user_personalization_insights (
         user_id,
         feedback_count,
         average_rating,
         confidence,
         easy_recipe_boost,
         quick_recipe_boost,
         ingredient_match_boost,
         technique_guidance_boost,
         cutting_meat_hard_count,
         oil_splatter_count,
         took_longer_than_expected_count,
         missing_ingredients_count,
         issue_counts,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         feedback_count = EXCLUDED.feedback_count,
         average_rating = EXCLUDED.average_rating,
         confidence = EXCLUDED.confidence,
         easy_recipe_boost = EXCLUDED.easy_recipe_boost,
         quick_recipe_boost = EXCLUDED.quick_recipe_boost,
         ingredient_match_boost = EXCLUDED.ingredient_match_boost,
         technique_guidance_boost = EXCLUDED.technique_guidance_boost,
         cutting_meat_hard_count = EXCLUDED.cutting_meat_hard_count,
         oil_splatter_count = EXCLUDED.oil_splatter_count,
         took_longer_than_expected_count = EXCLUDED.took_longer_than_expected_count,
         missing_ingredients_count = EXCLUDED.missing_ingredients_count,
         issue_counts = EXCLUDED.issue_counts,
         updated_at = NOW()
       RETURNING ${personalizationColumns}`,
      [
        userId,
        insight.feedbackCount,
        insight.averageRating,
        insight.confidence,
        insight.signals.preferEasyRecipes,
        insight.signals.preferQuickRecipes,
        insight.signals.preferIngredientFit,
        insight.signals.preferTechniqueGuidance,
        insight.issueCounts["cutting-meat-hard"],
        insight.issueCounts["oil-splatter"],
        insight.issueCounts["took-longer-than-expected"],
        insight.issueCounts["missing-ingredients"],
        JSON.stringify(insight.issueCounts),
      ],
    );
    const savedInsight = result.rows[0];

    if (savedInsight === undefined) {
      throw new Error("Personalization insight was not saved.");
    }

    return mapPersonalizationRow(savedInsight);
  }

  async getInsight(userId: string) {
    const result = await this.database.query<PersonalizationRow>(
      `SELECT ${personalizationColumns}
       FROM user_personalization_insights
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );
    const insight = result.rows[0];

    return insight === undefined
      ? emptyPersonalizationInsight()
      : mapPersonalizationRow(insight);
  }
}

const personalizationColumns = `
  feedback_count,
  average_rating,
  confidence,
  easy_recipe_boost,
  quick_recipe_boost,
  ingredient_match_boost,
  technique_guidance_boost,
  cutting_meat_hard_count,
  oil_splatter_count,
  took_longer_than_expected_count,
  missing_ingredients_count,
  issue_counts,
  updated_at
`;

function mapFeedbackRow(row: FeedbackRow): CookingFeedbackModel {
  return {
    id: row.id,
    cookingSessionId: row.cooking_session_id,
    recipeId: row.recipe_id,
    rating: row.rating,
    issues: normalizeFeedbackIssues(row.issues),
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPersonalizationRow(
  row: PersonalizationRow,
): PersonalizationInsightModel {
  const issueCounts = normalizeStoredIssueCounts(row);

  return {
    feedbackCount: row.feedback_count,
    averageRating: Number(row.average_rating),
    confidence: Number(row.confidence),
    signals: {
      preferEasyRecipes: Number(row.easy_recipe_boost),
      preferQuickRecipes: Number(row.quick_recipe_boost),
      preferIngredientFit: Number(row.ingredient_match_boost),
      preferTechniqueGuidance: Number(row.technique_guidance_boost),
    },
    issueCounts,
    insights: buildInsightMessages(issueCounts),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeStoredIssueCounts(row: PersonalizationRow) {
  const issueCounts = emptyFeedbackIssueCounts();
  const storedIssueCounts = parseStoredIssueCounts(row.issue_counts);

  for (const [issue, count] of Object.entries(storedIssueCounts)) {
    if (issue in issueCounts && typeof count === "number" && count >= 0) {
      issueCounts[issue as FeedbackIssue] = count;
    }
  }

  if (Object.values(issueCounts).some((count) => count > 0)) {
    return issueCounts;
  }

  return {
    ...issueCounts,
    "cutting-meat-hard": row.cutting_meat_hard_count,
    "oil-splatter": row.oil_splatter_count,
    "took-longer-than-expected": row.took_longer_than_expected_count,
    "missing-ingredients": row.missing_ingredients_count,
  } satisfies FeedbackIssueCounts;
}

function parseStoredIssueCounts(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;

      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
