import type { Pool } from "pg";

import type { RecipeModel } from "../recipes/recipe.model.js";
import { normalizeFeedbackIssues } from "../feedback/feedback.model.js";
import type {
  CookingSessionModel,
  CookingSessionStatus,
  PaginatedCookingSessions,
} from "./cooking-session.model.js";
import type {
  CookingHistoryQuery,
  StartCookingSessionInput,
  UpdateCookingSessionInput,
} from "./cooking-session.types.js";

interface CookingSessionRow {
  id: string;
  current_step: number;
  servings: number;
  status: CookingSessionStatus;
  started_at: Date;
  completed_at: Date | null;
  updated_at: Date;
  feedback_rating: number | null;
  feedback_issues: unknown;
  feedback_note: string | null;
  feedback_submitted_at: Date | null;
  total_steps: string;
  recipe_id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
  difficulty: RecipeModel["difficulty"];
  cook_time_minutes: number;
  base_servings: number;
  category_name: RecipeModel["category"];
}

export interface CookingSessionRepository {
  start(
    userId: string,
    input: StartCookingSessionInput,
  ): Promise<CookingSessionModel | null>;
  findById(userId: string, sessionId: string): Promise<CookingSessionModel | null>;
  update(
    userId: string,
    sessionId: string,
    input: Required<UpdateCookingSessionInput>,
  ): Promise<CookingSessionModel | null>;
  complete(
    userId: string,
    sessionId: string,
    finalStep: number,
  ): Promise<CookingSessionModel | null>;
  listHistory(
    userId: string,
    query: CookingHistoryQuery,
  ): Promise<PaginatedCookingSessions>;
}

export class PostgresCookingSessionRepository
  implements CookingSessionRepository
{
  constructor(private readonly database: Pool) {}

  async start(userId: string, input: StartCookingSessionInput) {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO cooking_sessions (user_id, recipe_id, servings)
       SELECT $1, r.id, COALESCE($3, r.base_servings)
       FROM recipes r
       WHERE r.slug = $2
         AND r.status = 'PUBLISHED'
         AND r.moderation_status = 'APPROVED'
       ON CONFLICT (user_id, recipe_id) WHERE status = 'IN_PROGRESS'
       DO UPDATE SET
         servings = COALESCE($3, cooking_sessions.servings),
         updated_at = NOW()
       RETURNING id`,
      [userId, input.recipeSlug, input.servings ?? null],
    );
    const sessionId = result.rows[0]?.id;

    if (sessionId === undefined) {
      return null;
    }

    return this.findById(userId, sessionId);
  }

  async findById(userId: string, sessionId: string) {
    const result = await this.database.query<CookingSessionRow>(
      `${cookingSessionSelect}
       WHERE cs.user_id = $1
         AND cs.id = $2
       GROUP BY ${cookingSessionGroupBy}
       LIMIT 1`,
      [userId, sessionId],
    );

    return result.rows[0] === undefined
      ? null
      : mapCookingSessionRow(result.rows[0]);
  }

  async update(
    userId: string,
    sessionId: string,
    input: Required<UpdateCookingSessionInput>,
  ) {
    const result = await this.database.query<CookingSessionRow>(
      `WITH updated_session AS (
         UPDATE cooking_sessions
         SET current_step = $3,
             servings = $4,
             updated_at = NOW()
         WHERE user_id = $1
           AND id = $2
           AND status = 'IN_PROGRESS'
         RETURNING *
       )
       ${cookingSessionSelectFrom("updated_session")}
       GROUP BY ${cookingSessionGroupBy}`,
      [userId, sessionId, input.currentStep, input.servings],
    );

    return result.rows[0] === undefined
      ? null
      : mapCookingSessionRow(result.rows[0]);
  }

  async complete(userId: string, sessionId: string, finalStep: number) {
    const result = await this.database.query<CookingSessionRow>(
      `WITH updated_session AS (
         UPDATE cooking_sessions
         SET status = 'COMPLETED',
             completed_at = COALESCE(completed_at, NOW()),
             current_step = $3,
             updated_at = NOW()
         WHERE user_id = $1
           AND id = $2
           AND status = 'IN_PROGRESS'
         RETURNING *
       )
       ${cookingSessionSelectFrom("updated_session")}
       GROUP BY ${cookingSessionGroupBy}`,
      [userId, sessionId, finalStep],
    );

    return result.rows[0] === undefined
      ? null
      : mapCookingSessionRow(result.rows[0]);
  }

  async listHistory(
    userId: string,
    query: CookingHistoryQuery,
  ): Promise<PaginatedCookingSessions> {
    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM cooking_sessions
       WHERE user_id = $1
         AND status = 'COMPLETED'`,
      [userId],
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const offset = (query.page - 1) * query.limit;
    const sortSql =
      query.sort === "rating-desc"
        ? "cf.rating DESC NULLS LAST, cs.completed_at DESC, r.title"
        : query.sort === "started-at-desc"
        ? "cs.started_at DESC, cs.completed_at DESC, r.title"
        : "cs.completed_at DESC, cs.started_at DESC, r.title";

    const result = await this.database.query<CookingSessionRow>(
      `${cookingSessionSelect}
       WHERE cs.user_id = $1
         AND cs.status = 'COMPLETED'
       GROUP BY ${cookingSessionGroupBy}
       ORDER BY ${sortSql}
       LIMIT $2
       OFFSET $3`,
      [userId, query.limit, offset],
    );

    return {
      items: result.rows.map(mapCookingSessionRow),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }
}

const cookingSessionSelect = cookingSessionSelectFrom("cooking_sessions");

function cookingSessionSelectFrom(sessionTable: string) {
  return `
    SELECT
      cs.id,
      cs.current_step,
      cs.servings,
      cs.status,
      cs.started_at,
      cs.completed_at,
      cs.updated_at,
      cf.rating AS feedback_rating,
      cf.issues AS feedback_issues,
      cf.note AS feedback_note,
      cf.updated_at AS feedback_submitted_at,
      COUNT(rs.id) AS total_steps,
      r.id AS recipe_id,
      r.slug,
      r.title,
      r.description,
      r.image_url,
      r.image_alt,
      r.difficulty,
      r.cook_time_minutes,
      r.base_servings,
      c.name AS category_name
    FROM ${sessionTable} cs
    JOIN recipes r ON r.id = cs.recipe_id
    JOIN categories c ON c.id = r.category_id
    LEFT JOIN recipe_steps rs ON rs.recipe_id = r.id
    LEFT JOIN cooking_feedback cf ON cf.cooking_session_id = cs.id
  `;
}

const cookingSessionGroupBy = `
  cs.id,
  cs.current_step,
  cs.servings,
  cs.status,
  cs.started_at,
  cs.completed_at,
  cs.updated_at,
  cf.rating,
  cf.issues,
  cf.note,
  cf.updated_at,
  r.id,
  r.slug,
  r.title,
  r.description,
  r.image_url,
  r.image_alt,
  r.difficulty,
  r.cook_time_minutes,
  r.base_servings,
  c.name
`;

function mapCookingSessionRow(row: CookingSessionRow): CookingSessionModel {
  return {
    id: row.id,
    recipe: {
      id: row.recipe_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      image: row.image_url,
      imageAlt: row.image_alt,
      difficulty: row.difficulty,
      cookTimeMinutes: row.cook_time_minutes,
      baseServings: row.base_servings,
      category: row.category_name,
    },
    currentStep: row.current_step,
    totalSteps: Number(row.total_steps),
    servings: row.servings,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    feedback:
      row.feedback_rating === null || row.feedback_submitted_at === null
        ? null
        : {
            rating: row.feedback_rating,
            issues: normalizeFeedbackIssues(row.feedback_issues),
            note: row.feedback_note,
            submittedAt: row.feedback_submitted_at.toISOString(),
          },
    updatedAt: row.updated_at.toISOString(),
  };
}
