import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type {
  AuthRepository,
  CreatePasswordUserInput,
  GoogleUserInput,
  RefreshTokenRecord,
  SaveRefreshTokenInput,
} from "../src/modules/auth/auth.repository.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.model.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";
import type { SavedRecipeRepository } from "../src/modules/saved-recipes/saved-recipe.repository.js";

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

class InMemorySavedRecipeRepository implements SavedRecipeRepository {
  private readonly savedRecipes = new Map<string, Set<string>>();

  list(userId: string) {
    const slugs = this.savedRecipes.get(userId) ?? new Set<string>();

    return Promise.resolve(
      Array.from(slugs).map((slug) => ({
        id: "recipe-1",
        slug,
        title: "Rau Muống Xào Tỏi",
        description: "Rau muống xào nhanh với tỏi.",
        image: "/images/recipes/rau-muong-xao-toi.png",
        imageAlt: "Rau muống xanh xào tỏi",
        difficulty: "de" as const,
        cookTimeMinutes: 10,
        baseServings: 4,
        category: "Món xào" as const,
        savedAt: new Date(0).toISOString(),
      })),
    );
  }

  save(userId: string, recipeSlug: string) {
    const savedRecipes = this.savedRecipes.get(userId) ?? new Set<string>();
    savedRecipes.add(recipeSlug);
    this.savedRecipes.set(userId, savedRecipes);

    return Promise.resolve({
      id: "recipe-1",
      slug: recipeSlug,
      title: "Rau Muống Xào Tỏi",
      description: "Rau muống xào nhanh với tỏi.",
      image: "/images/recipes/rau-muong-xao-toi.png",
      imageAlt: "Rau muống xanh xào tỏi",
      difficulty: "de" as const,
      cookTimeMinutes: 10,
      baseServings: 4,
      category: "Món xào" as const,
      savedAt: new Date(0).toISOString(),
    });
  }

  remove(userId: string, recipeSlug: string) {
    this.savedRecipes.get(userId)?.delete(recipeSlug);
    return Promise.resolve(true);
  }
}

function createTestApp() {
  return createApp({
    authRepository: new InMemoryAuthRepository(),
    savedRecipeRepository: new InMemorySavedRecipeRepository(),
    categoryRepository,
    recipeRepository,
  });
}

describe("Auth and saved recipes API", () => {
  it("registers, reads profile, refreshes, logs out, and saves recipes", async () => {
    const app = createTestApp();

    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      email: "user@example.com",
      password: "matkhau123",
      displayName: "Bếp Nhà",
    });

    expect(registerResponse.status).toBe(201);
    const registered = registerResponse.body as {
      data: {
        user: { email: string; displayName: string };
        tokens: { accessToken: string; refreshToken: string };
      };
    };
    expect(registered.data.user).toMatchObject({
      email: "user@example.com",
      displayName: "Bếp Nhà",
    });

    const meResponse = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${registered.data.tokens.accessToken}`);
    expect(meResponse.status).toBe(200);

    const savedResponse = await request(app)
      .post("/api/v1/me/saved-recipes/rau-muong-xao-toi")
      .set("Authorization", `Bearer ${registered.data.tokens.accessToken}`);
    expect(savedResponse.status).toBe(201);

    const listSavedResponse = await request(app)
      .get("/api/v1/me/saved-recipes")
      .set("Authorization", `Bearer ${registered.data.tokens.accessToken}`);
    expect(listSavedResponse.status).toBe(200);
    const savedBody = listSavedResponse.body as {
      data: Array<{ slug: string }>;
    };
    expect(savedBody.data[0]).toMatchObject({ slug: "rau-muong-xao-toi" });

    const refreshResponse = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken: registered.data.tokens.refreshToken,
    });
    expect(refreshResponse.status).toBe(200);

    const logoutResponse = await request(app).post("/api/v1/auth/logout").send({
      refreshToken: registered.data.tokens.refreshToken,
    });
    expect(logoutResponse.status).toBe(204);
  });

  it("requires auth for saved recipes", async () => {
    const app = createTestApp();
    const response = await request(app).get("/api/v1/me/saved-recipes");

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });
});
