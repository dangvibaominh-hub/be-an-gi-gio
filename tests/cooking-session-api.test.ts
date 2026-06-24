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
import type { CookingSessionModel } from "../src/modules/cooking-sessions/cooking-session.model.js";
import type { CookingSessionRepository } from "../src/modules/cooking-sessions/cooking-session.repository.js";
import type {
  CookingHistoryQuery,
  StartCookingSessionInput,
  UpdateCookingSessionInput,
} from "../src/modules/cooking-sessions/cooking-session.types.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";

const sessionId = "5d46a923-d409-4b3e-b71b-310b3bc3eb23";

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

class InMemoryCookingSessionRepository implements CookingSessionRepository {
  private readonly sessions = new Map<string, CookingSessionModel>();
  private readonly activeSessionIds = new Map<string, string>();

  start(userId: string, input: StartCookingSessionInput) {
    if (input.recipeSlug !== "rau-muong-xao-toi") {
      return Promise.resolve(null);
    }

    const activeKey = `${userId}:${input.recipeSlug}`;
    const activeSessionId = this.activeSessionIds.get(activeKey);

    if (activeSessionId !== undefined) {
      const activeSession = this.sessions.get(activeSessionId);

      if (activeSession !== undefined) {
        const updatedSession = {
          ...activeSession,
          servings: input.servings ?? activeSession.servings,
          updatedAt: new Date("2026-01-01T00:01:00.000Z").toISOString(),
        };
        this.sessions.set(activeSession.id, updatedSession);

        return Promise.resolve(updatedSession);
      }
    }

    const session = createSession({
      id: sessionId,
      servings: input.servings ?? 4,
    });
    this.sessions.set(session.id, session);
    this.activeSessionIds.set(activeKey, session.id);

    return Promise.resolve(session);
  }

  findById(_userId: string, sessionIdToFind: string) {
    return Promise.resolve(this.sessions.get(sessionIdToFind) ?? null);
  }

  update(
    _userId: string,
    sessionIdToUpdate: string,
    input: Required<UpdateCookingSessionInput>,
  ) {
    const session = this.sessions.get(sessionIdToUpdate);

    if (session === undefined || session.status !== "IN_PROGRESS") {
      return Promise.resolve(null);
    }

    const updatedSession = {
      ...session,
      currentStep: input.currentStep,
      servings: input.servings,
      updatedAt: new Date("2026-01-01T00:02:00.000Z").toISOString(),
    };
    this.sessions.set(session.id, updatedSession);

    return Promise.resolve(updatedSession);
  }

  complete(_userId: string, sessionIdToComplete: string, finalStep: number) {
    const session = this.sessions.get(sessionIdToComplete);

    if (session === undefined || session.status !== "IN_PROGRESS") {
      return Promise.resolve(null);
    }

    const completedSession: CookingSessionModel = {
      ...session,
      currentStep: finalStep,
      status: "COMPLETED",
      completedAt: new Date("2026-01-01T00:03:00.000Z").toISOString(),
      updatedAt: new Date("2026-01-01T00:03:00.000Z").toISOString(),
    };
    this.sessions.set(session.id, completedSession);
    this.activeSessionIds.delete(`${_userId}:${session.recipe.slug}`);

    return Promise.resolve(completedSession);
  }

  listHistory(_userId: string, query: CookingHistoryQuery) {
    const items = Array.from(this.sessions.values()).filter(
      (session) => session.status === "COMPLETED",
    );
    const offset = (query.page - 1) * query.limit;

    return Promise.resolve({
      items: items.slice(offset, offset + query.limit),
      page: query.page,
      limit: query.limit,
      total: items.length,
      totalPages: items.length === 0 ? 0 : Math.ceil(items.length / query.limit),
    });
  }
}

function createSession(input: { id: string; servings: number }): CookingSessionModel {
  return {
    id: input.id,
    recipe: {
      id: "recipe-1",
      slug: "rau-muong-xao-toi",
      title: "Rau Muong Xao Toi",
      description: "Rau muong xao nhanh voi toi.",
      image: "/images/recipes/rau-muong-xao-toi.png",
      imageAlt: "Rau muong xanh xao toi",
      difficulty: "de",
      cookTimeMinutes: 10,
      baseServings: 4,
      category: "Món xào",
    },
    currentStep: 1,
    totalSteps: 3,
    servings: input.servings,
    status: "IN_PROGRESS",
    startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    completedAt: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
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
    cookingSessionRepository: new InMemoryCookingSessionRepository(),
    categoryRepository,
    recipeRepository,
  });
}

describe("Cooking session API", () => {
  it("starts, resumes, updates, completes, and lists cooking history", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const startResponse = await request(app)
      .post("/api/v1/cooking-sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ recipeSlug: "rau-muong-xao-toi", servings: 2 });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body).toMatchObject({
      success: true,
      data: {
        id: sessionId,
        currentStep: 1,
        totalSteps: 3,
        servings: 2,
        status: "IN_PROGRESS",
        completedAt: null,
      },
    });

    const resumeResponse = await request(app)
      .post("/api/v1/cooking-sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ recipeSlug: "rau-muong-xao-toi" });
    const resumeBody = resumeResponse.body as { data: CookingSessionModel };
    expect(resumeResponse.status).toBe(201);
    expect(resumeBody.data.id).toBe(sessionId);

    const updateResponse = await request(app)
      .patch(`/api/v1/cooking-sessions/${sessionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentStep: 2 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      data: {
        currentStep: 2,
        servings: 2,
      },
    });

    const completeResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body).toMatchObject({
      data: {
        currentStep: 3,
        status: "COMPLETED",
        completedAt: "2026-01-01T00:03:00.000Z",
      },
    });

    const completeAgainResponse = await request(app)
      .post(`/api/v1/cooking-sessions/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`);
    const completeAgainBody = completeAgainResponse.body as {
      data: CookingSessionModel;
    };
    expect(completeAgainResponse.status).toBe(200);
    expect(completeAgainBody.data.completedAt).toBe(
      "2026-01-01T00:03:00.000Z",
    );

    const historyResponse = await request(app)
      .get("/api/v1/me/cooking-history?limit=5&sort=completed-at-desc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body).toMatchObject({
      success: true,
      meta: {
        page: 1,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
      data: [
        {
          id: sessionId,
          status: "COMPLETED",
          recipe: {
            slug: "rau-muong-xao-toi",
          },
        },
      ],
    });
  });

  it("requires auth for cooking sessions and history", async () => {
    const app = createTestApp();

    const startResponse = await request(app)
      .post("/api/v1/cooking-sessions")
      .send({ recipeSlug: "rau-muong-xao-toi" });
    expect(startResponse.status).toBe(401);

    const historyResponse = await request(app).get("/api/v1/me/cooking-history");
    expect(historyResponse.status).toBe(401);
  });

  it("rejects current step beyond recipe steps", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    await request(app)
      .post("/api/v1/cooking-sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ recipeSlug: "rau-muong-xao-toi" });

    const response = await request(app)
      .patch(`/api/v1/cooking-sessions/${sessionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentStep: 4 });

    expect(response.status).toBe(400);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CURRENT_STEP");
  });

  it("returns not found for an unavailable recipe", async () => {
    const app = createTestApp();
    const accessToken = await register(app);

    const response = await request(app)
      .post("/api/v1/cooking-sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ recipeSlug: "khong-ton-tai" });

    expect(response.status).toBe(404);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("RECIPE_NOT_FOUND");
  });
});
