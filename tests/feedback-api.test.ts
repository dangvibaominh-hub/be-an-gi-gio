import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type {
  AuthRepository,
  CreatePasswordUserInput,
  GoogleUserInput,
  RefreshTokenRecord,
  SaveRefreshTokenInput,
} from "../src/modules/auth/auth.repository.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.model.js";
import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type {
  CookingFeedbackModel,
  FeedbackSessionRecord,
  FeedbackSignal,
  PersonalizationInsightModel,
} from "../src/modules/feedback/feedback.model.js";
import { emptyPersonalizationInsight } from "../src/modules/feedback/feedback.model.js";
import type { FeedbackRepository } from "../src/modules/feedback/feedback.repository.js";
import type { SubmitFeedbackInput } from "../src/modules/feedback/feedback.types.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";

const completedSessionId = "5d46a923-d409-4b3e-b71b-310b3bc3eb23";
const inProgressSessionId = "759d6023-94ad-406d-9fd1-89c8f220de1e";

const categoryRepository: CategoryRepository = {
  list() {
    return Promise.resolve([]);
  },
};

const recipeRepository: RecipeRepository = {
  list() {
    return Promise.resolve({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    });
  },
  findBySlug() {
    return Promise.resolve(null);
  },
};

class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  findUserByEmail(normalizedEmail: string) {
    return Promise.resolve(
      Array.from(this.users.values()).find(
        (user) => user.normalizedEmail === normalizedEmail,
      ) ?? null,
    );
  }

  findUserById(userId: string) {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  createPasswordUser(input: CreatePasswordUserInput) {
    const now = new Date();
    const user: AuthUserRecord = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      role: "USER",
      status: "ACTIVE",
      provider: "PASSWORD",
      googleSubject: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  upsertGoogleUser(input: GoogleUserInput) {
    const now = new Date();
    const user: AuthUserRecord = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      passwordHash: null,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      role: "USER",
      status: "ACTIVE",
      provider: "GOOGLE",
      googleSubject: input.googleSubject,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  updateProfile(userId: string, input: { displayName: string }) {
    const user = this.users.get(userId);

    if (user === undefined) {
      return Promise.resolve(null);
    }

    const updatedUser = {
      ...user,
      displayName: input.displayName,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);

    return Promise.resolve(updatedUser);
  }

  saveRefreshToken(input: SaveRefreshTokenInput) {
    this.refreshTokens.set(input.tokenHash, {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });

    return Promise.resolve();
  }

  findRefreshToken(tokenHash: string) {
    return Promise.resolve(this.refreshTokens.get(tokenHash) ?? null);
  }

  revokeRefreshToken(tokenHash: string) {
    const token = this.refreshTokens.get(tokenHash);

    if (token !== undefined) {
      this.refreshTokens.set(tokenHash, {
        ...token,
        revokedAt: token.revokedAt ?? new Date(),
      });
    }

    return Promise.resolve();
  }
}

class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly sessions = new Map<string, FeedbackSessionRecord>([
    [
      `user-1:${completedSessionId}`,
      {
        id: completedSessionId,
        recipeId: "recipe-1",
        recipeCategory: "Món xào",
        status: "COMPLETED",
      },
    ],
    [
      `user-1:${inProgressSessionId}`,
      {
        id: inProgressSessionId,
        recipeId: "recipe-1",
        recipeCategory: "Món xào",
        status: "IN_PROGRESS",
      },
    ],
  ]);
  private readonly feedbacks = new Map<string, CookingFeedbackModel>();
  private readonly insights = new Map<string, PersonalizationInsightModel>();

  findSessionForFeedback(userId: string, cookingSessionId: string) {
    return Promise.resolve(
      this.sessions.get(`${userId}:${cookingSessionId}`) ?? null,
    );
  }

  upsertFeedback(
    userId: string,
    session: FeedbackSessionRecord,
    input: SubmitFeedbackInput,
  ) {
    const now = new Date("2026-01-01T00:05:00.000Z").toISOString();
    const current = this.feedbacks.get(session.id);
    const feedback: CookingFeedbackModel = {
      id: current?.id ?? "feedback-1",
      cookingSessionId: session.id,
      recipeId: session.recipeId,
      rating: input.rating,
      issues: input.issues,
      note: input.note ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    this.feedbacks.set(session.id, feedback);
    void userId;

    return Promise.resolve(feedback);
  }

  listFeedbackSignals(): Promise<FeedbackSignal[]> {
    return Promise.resolve(
      Array.from(this.feedbacks.values()).map((feedback) => ({
        rating: feedback.rating,
        issues: feedback.issues,
      })),
    );
  }

  saveInsight(userId: string, insight: PersonalizationInsightModel) {
    this.insights.set(userId, insight);
    return Promise.resolve(insight);
  }

  getInsight(userId: string) {
    return Promise.resolve(
      this.insights.get(userId) ?? emptyPersonalizationInsight(),
    );
  }
}

async function register(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: "cook@example.com",
    password: "matkhau123",
    displayName: "Cook",
  });
  const body = response.body as {
    data: { tokens: { accessToken: string } };
  };

  return body.data.tokens.accessToken;
}

function createTestApp() {
  return createApp({
    authRepository: new InMemoryAuthRepository(),
    feedbackRepository: new InMemoryFeedbackRepository(),
    categoryRepository,
    recipeRepository,
  });
}

describe("Feedback API", () => {
  it("returns feedback tag options for the session recipe category", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const response = await request(app)
      .get(`/api/v1/cooking-sessions/${completedSessionId}/feedback/options`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        cookingSessionId: completedSessionId,
        recipeId: "recipe-1",
        recipeCategory: "Món xào",
        issues: [
          { value: "cutting-meat-hard", label: "Cắt thịt khó quá" },
          {
            value: "pan-sticking-or-burning",
            label: "Bị dính hoặc cháy chảo",
          },
          { value: "vegetables-too-soft", label: "Rau bị mềm quá" },
          { value: "too-oily", label: "Món bị nhiều dầu" },
          {
            value: "took-longer-than-expected",
            label: "Mất nhiều thời gian hơn dự kiến",
          },
          { value: "missing-ingredients", label: "Thiếu nguyên liệu" },
          { value: "hard-to-follow-steps", label: "Các bước hơi khó theo" },
          { value: "taste-not-right", label: "Vị chưa đúng ý" },
        ],
      },
    });
  });

  it("saves cooking feedback and exposes personalization insight", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const feedbackResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${completedSessionId}/feedback`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rating: 4,
        issues: ["took-longer-than-expected", "missing-ingredients"],
        note: "Can goi y mon nhanh hon.",
      });

    expect(feedbackResponse.status).toBe(201);
    expect(feedbackResponse.body).toMatchObject({
      success: true,
      data: {
        cookingSessionId: completedSessionId,
        rating: 4,
        issues: ["took-longer-than-expected", "missing-ingredients"],
        note: "Can goi y mon nhanh hon.",
      },
      meta: {
        personalization: {
          feedbackCount: 1,
          averageRating: 4,
          confidence: 0.2,
          signals: {
            preferQuickRecipes: 0.08,
            preferIngredientFit: 0.08,
          },
        },
      },
    });

    const insightResponse = await request(app)
      .get("/api/v1/me/personalization")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(insightResponse.status).toBe(200);
    expect(insightResponse.body).toMatchObject({
      success: true,
      data: {
        feedbackCount: 1,
        issueCounts: {
          "took-longer-than-expected": 1,
          "missing-ingredients": 1,
        },
        insights: [
          "Ưu tiên món nhanh hơn thời gian dự kiến.",
          "Tăng ưu tiên công thức khớp nguyên liệu đang có.",
        ],
      },
    });
  });

  it("requires completed sessions before accepting feedback", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const response = await request(app)
      .post(`/api/v1/cooking-sessions/${inProgressSessionId}/feedback`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(409);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("COOKING_SESSION_NOT_COMPLETED");
  });

  it("accepts only feedback tags that fit the recipe category", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const acceptedResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${completedSessionId}/feedback`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rating: 4,
        issues: ["pan-sticking-or-burning", "too-oily"],
      });

    expect(acceptedResponse.status).toBe(201);
    expect(acceptedResponse.body).toMatchObject({
      data: {
        issues: ["pan-sticking-or-burning", "too-oily"],
      },
      meta: {
        personalization: {
          issueCounts: {
            "pan-sticking-or-burning": 1,
            "too-oily": 1,
          },
        },
      },
    });

    const rejectedResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${completedSessionId}/feedback`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rating: 4,
        issues: ["soup-too-bland-or-salty"],
      });

    expect(rejectedResponse.status).toBe(400);
    expect(rejectedResponse.body).toMatchObject({
      error: {
        code: "FEEDBACK_ISSUE_NOT_ALLOWED_FOR_RECIPE",
      },
    });
  });

  it("requires authentication and validates rating", async () => {
    const app = createTestApp();

    const optionsAuthResponse = await request(app).get(
      `/api/v1/cooking-sessions/${completedSessionId}/feedback/options`,
    );
    expect(optionsAuthResponse.status).toBe(401);

    const authResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${completedSessionId}/feedback`)
      .send({ rating: 5 });
    expect(authResponse.status).toBe(401);

    const accessToken = await register(app);
    const validationResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${completedSessionId}/feedback`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ rating: 6 });

    expect(validationResponse.status).toBe(400);
  });
});
