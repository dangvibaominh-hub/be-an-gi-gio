import { randomUUID } from "node:crypto";

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
import { hashPassword } from "../src/shared/security/password.js";
import type {
  AdminAuditLogModel,
  AdminCategoryModel,
  AdminRecipeDetailModel,
  AdminUserModel,
  PaginatedAdminResult,
  RecipeStatus,
} from "../src/modules/admin/admin.model.js";
import type {
  AdminRepository,
  CreateAuditLogInput,
} from "../src/modules/admin/admin.repository.js";
import type {
  AdminCreateRecipeInput,
  AdminListAuditLogsQuery,
  AdminListRecipesQuery,
  AdminListUsersQuery,
  AdminRecipeIngredientInput,
  AdminRecipeStepInput,
  AdminUpdateRecipeInput,
} from "../src/modules/admin/admin.types.js";
import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";

const adminId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const recipeId = "33333333-3333-4333-8333-333333333333";
const geminiRecipeId = "44444444-4444-4444-8444-444444444444";
const category: AdminCategoryModel = {
  id: "55555555-5555-4555-8555-555555555555",
  slug: "mon-xao",
  name: "Món xào",
};

const categoryRepository: CategoryRepository = {
  list() {
    return Promise.resolve([category]);
  },
};

const recipeRepository: RecipeRepository = {
  list(query) {
    return Promise.resolve({
      items: [],
      page: query.page,
      limit: query.limit,
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

  constructor(users: AuthUserRecord[]) {
    for (const user of users) {
      this.users.set(user.id, user);
    }
  }

  findUserByEmail(normalizedEmail: string) {
    return Promise.resolve(
      Array.from(this.users.values()).find(
        (user) => user.normalizedEmail === normalizedEmail,
      ) ?? null,
    );
  }

  findUserById(id: string) {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  createPasswordUser(input: CreatePasswordUserInput) {
    const now = new Date();
    const user: AuthUserRecord = {
      id: randomUUID(),
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
      id: randomUUID(),
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

  updateProfile(id: string, input: { displayName: string }) {
    const user = this.users.get(id);

    if (user === undefined) {
      return Promise.resolve(null);
    }

    const updated = { ...user, displayName: input.displayName, updatedAt: new Date() };
    this.users.set(id, updated);
    return Promise.resolve(updated);
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

class InMemoryAdminRepository implements AdminRepository {
  readonly auditLogs: AdminAuditLogModel[] = [];
  revokedRefreshTokenUserIds: string[] = [];
  private readonly recipes = new Map<string, AdminRecipeDetailModel>();
  private readonly users = new Map<string, AdminUserModel>();

  constructor(users: AdminUserModel[]) {
    for (const user of users) {
      this.users.set(user.id, user);
    }

    this.recipes.set(recipeId, createRecipeFixture(recipeId, "SEED", "APPROVED"));
    this.recipes.set(
      geminiRecipeId,
      createRecipeFixture(geminiRecipeId, "GEMINI", "PENDING"),
    );
  }

  listRecipes(query: AdminListRecipesQuery) {
    const recipes = Array.from(this.recipes.values()).filter(
      (recipe) =>
        (query.status === undefined || recipe.status === query.status) &&
        (query.source === undefined || recipe.source === query.source) &&
        (query.moderationStatus === undefined ||
          recipe.moderationStatus === query.moderationStatus),
    );

    return Promise.resolve(paginate(recipes, query.page, query.limit));
  }

  findRecipeById(id: string) {
    return Promise.resolve(this.recipes.get(id) ?? null);
  }

  createRecipe(input: AdminCreateRecipeInput, actorUserId: string) {
    const id = "66666666-6666-4666-8666-666666666666";
    const now = new Date().toISOString();
    const recipe: AdminRecipeDetailModel = {
      id,
      slug: input.slug,
      title: input.title,
      description: input.description,
      image: input.image,
      imageAlt: input.imageAlt,
      difficulty: input.difficulty,
      cookTimeMinutes: input.cookTimeMinutes,
      baseServings: input.baseServings,
      category,
      status: input.status,
      source: "ADMIN",
      aiModel: null,
      moderationStatus: "APPROVED",
      createdBy: { id: actorUserId, email: "admin@example.com" },
      createdAt: now,
      updatedAt: now,
      ingredients: mapIngredientInputs(input.ingredients),
      steps: mapStepInputs(input.steps),
    };

    this.recipes.set(id, recipe);
    return Promise.resolve(recipe);
  }

  updateRecipe(id: string, input: AdminUpdateRecipeInput) {
    const recipe = this.recipes.get(id);

    if (recipe === undefined) {
      return Promise.resolve(null);
    }

    const updated: AdminRecipeDetailModel = {
      ...recipe,
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.image === undefined ? {} : { image: input.image }),
      ...(input.imageAlt === undefined ? {} : { imageAlt: input.imageAlt }),
      ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
      ...(input.cookTimeMinutes === undefined
        ? {}
        : { cookTimeMinutes: input.cookTimeMinutes }),
      ...(input.baseServings === undefined
        ? {}
        : { baseServings: input.baseServings }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.ingredients === undefined
        ? {}
        : { ingredients: mapIngredientInputs(input.ingredients) }),
      ...(input.steps === undefined ? {} : { steps: mapStepInputs(input.steps) }),
      updatedAt: new Date().toISOString(),
    };

    this.recipes.set(id, updated);
    return Promise.resolve(updated);
  }

  setRecipeStatus(id: string, status: RecipeStatus) {
    const recipe = this.recipes.get(id);

    if (recipe === undefined) {
      return Promise.resolve(null);
    }

    const updated = { ...recipe, status, updatedAt: new Date().toISOString() };
    this.recipes.set(id, updated);
    return Promise.resolve(updated);
  }

  setRecipeModeration(
    id: string,
    moderationStatus: "APPROVED" | "REJECTED",
    status: RecipeStatus,
  ) {
    const recipe = this.recipes.get(id);

    if (recipe === undefined) {
      return Promise.resolve(null);
    }

    const updated = {
      ...recipe,
      moderationStatus,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.recipes.set(id, updated);
    return Promise.resolve(updated);
  }

  listUsers(query: AdminListUsersQuery) {
    const users = Array.from(this.users.values()).filter(
      (user) =>
        (query.role === undefined || user.role === query.role) &&
        (query.status === undefined || user.status === query.status),
    );

    return Promise.resolve(paginate(users, query.page, query.limit));
  }

  updateUserStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    const user = this.users.get(id);

    if (user === undefined) {
      return Promise.resolve(null);
    }

    const updated = { ...user, status, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  revokeUserRefreshTokens(id: string) {
    this.revokedRefreshTokenUserIds.push(id);
    return Promise.resolve();
  }

  createAuditLog(input: CreateAuditLogInput) {
    const log: AdminAuditLogModel = {
      id: randomUUID(),
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? {},
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(log);
    return Promise.resolve(log);
  }

  listAuditLogs(query: AdminListAuditLogsQuery) {
    const logs = this.auditLogs.filter(
      (log) =>
        (query.actorUserId === undefined ||
          log.actorUserId === query.actorUserId) &&
        (query.entityType === undefined || log.entityType === query.entityType),
    );

    return Promise.resolve(paginate(logs, query.page, query.limit));
  }
}

async function createTestContext() {
  const adminPasswordHash = await hashPassword("adminpass123");
  const userPasswordHash = await hashPassword("userpass123");
  const now = new Date("2026-06-27T00:00:00.000Z");
  const authUsers: AuthUserRecord[] = [
    {
      id: adminId,
      email: "admin@example.com",
      normalizedEmail: "admin@example.com",
      passwordHash: adminPasswordHash,
      displayName: "Admin",
      avatarUrl: null,
      role: "ADMIN",
      status: "ACTIVE",
      provider: "PASSWORD",
      googleSubject: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: userId,
      email: "user@example.com",
      normalizedEmail: "user@example.com",
      passwordHash: userPasswordHash,
      displayName: "User",
      avatarUrl: null,
      role: "USER",
      status: "ACTIVE",
      provider: "PASSWORD",
      googleSubject: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const adminUsers: AdminUserModel[] = authUsers.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    provider: user.provider,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));
  const adminRepository = new InMemoryAdminRepository(adminUsers);
  const app = createApp({
    authRepository: new InMemoryAuthRepository(authUsers),
    adminRepository,
    categoryRepository,
    recipeRepository,
  });
  const adminLogin = await request(app).post("/api/v1/auth/login").send({
    email: "admin@example.com",
    password: "adminpass123",
  });
  const userLogin = await request(app).post("/api/v1/auth/login").send({
    email: "user@example.com",
    password: "userpass123",
  });

  return {
    app,
    adminRepository,
    adminToken: (adminLogin.body as AuthResponse).data.tokens.accessToken,
    userToken: (userLogin.body as AuthResponse).data.tokens.accessToken,
  };
}

describe("Admin API", () => {
  it("requires an ADMIN access token", async () => {
    const { app, userToken } = await createTestContext();

    const noAuthResponse = await request(app).get("/api/v1/admin/recipes");
    expect(noAuthResponse.status).toBe(401);

    const userResponse = await request(app)
      .get("/api/v1/admin/recipes")
      .set("Authorization", `Bearer ${userToken}`);
    expect(userResponse.status).toBe(403);
  });

  it("creates, updates, hides recipes and writes audit logs", async () => {
    const { app, adminRepository, adminToken } = await createTestContext();
    const createResponse = await request(app)
      .post("/api/v1/admin/recipes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(recipeInput());

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      success: true,
      data: {
        slug: "dau-hu-xao-nam",
        source: "ADMIN",
        moderationStatus: "APPROVED",
      },
    });
    const createdId = (createResponse.body as { data: { id: string } }).data.id;

    const updateResponse = await request(app)
      .patch(`/api/v1/admin/recipes/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Đậu hũ xào nấm mới", status: "PUBLISHED" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      data: { title: "Đậu hũ xào nấm mới", status: "PUBLISHED" },
    });

    const hideResponse = await request(app)
      .delete(`/api/v1/admin/recipes/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(hideResponse.status).toBe(204);

    const detailResponse = await request(app)
      .get(`/api/v1/admin/recipes/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detailResponse.body).toMatchObject({ data: { status: "HIDDEN" } });

    expect(adminRepository.auditLogs.map((log) => log.action)).toEqual([
      "RECIPE_HIDDEN",
      "RECIPE_UPDATED",
      "RECIPE_CREATED",
    ]);
  });

  it("moderates Gemini recipes only", async () => {
    const { app, adminToken } = await createTestContext();

    const approveResponse = await request(app)
      .post(`/api/v1/admin/recipes/${geminiRecipeId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body).toMatchObject({
      data: {
        id: geminiRecipeId,
        source: "GEMINI",
        moderationStatus: "APPROVED",
        status: "PUBLISHED",
      },
    });

    const rejectSeedResponse = await request(app)
      .patch(`/api/v1/admin/recipes/${recipeId}/moderation`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ moderationStatus: "REJECTED" });

    expect(rejectSeedResponse.status).toBe(409);
    expect(rejectSeedResponse.body).toMatchObject({
      error: { code: "RECIPE_NOT_AI_GENERATED" },
    });
  });

  it("updates user status, revokes refresh tokens and prevents self suspend", async () => {
    const { app, adminRepository, adminToken } = await createTestContext();

    const suspendResponse = await request(app)
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUSPENDED" });

    expect(suspendResponse.status).toBe(200);
    expect(suspendResponse.body).toMatchObject({
      data: { id: userId, status: "SUSPENDED" },
    });
    expect(adminRepository.revokedRefreshTokenUserIds).toEqual([userId]);

    const selfSuspendResponse = await request(app)
      .patch(`/api/v1/admin/users/${adminId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUSPENDED" });

    expect(selfSuspendResponse.status).toBe(409);
    expect(selfSuspendResponse.body).toMatchObject({
      error: { code: "SELF_SUSPEND_NOT_ALLOWED" },
    });
  });
});

interface AuthResponse {
  data: {
    tokens: {
      accessToken: string;
    };
  };
}

function recipeInput(): AdminCreateRecipeInput {
  return {
    slug: "dau-hu-xao-nam",
    title: "Đậu hũ xào nấm",
    description: "Món đậu hũ xào nấm nhanh, dễ nấu cho bữa tối.",
    image: "/images/recipes/dau-hu-xao-nam.png",
    imageAlt: "Đĩa đậu hũ xào nấm nóng",
    difficulty: "de",
    cookTimeMinutes: 20,
    baseServings: 2,
    categorySlug: "mon-xao",
    status: "DRAFT",
    ingredients: [
      {
        name: "Đậu hũ",
        amount: 300,
        unit: "g",
        prepNote: "Cắt miếng vừa ăn",
      },
    ],
    steps: [
      {
        content: "Làm nóng chảo rồi xào nấm trước khi cho đậu hũ vào.",
        estimatedMinutes: 8,
        techniqueIcon: "chao",
        isTricky: false,
        timerSeconds: null,
      },
    ],
  };
}

function createRecipeFixture(
  id: string,
  source: "SEED" | "GEMINI",
  moderationStatus: "APPROVED" | "PENDING",
): AdminRecipeDetailModel {
  const now = new Date("2026-06-27T00:00:00.000Z").toISOString();

  return {
    id,
    slug: source === "GEMINI" ? "gemini-canh-rau" : "rau-muong-xao-toi",
    title: source === "GEMINI" ? "Canh rau Gemini" : "Rau muống xào tỏi",
    description: "Một công thức dùng trong test admin.",
    image: "/images/recipes/test.png",
    imageAlt: "Món ăn test",
    difficulty: "de",
    cookTimeMinutes: 15,
    baseServings: 2,
    category,
    status: "PUBLISHED",
    source,
    aiModel: source === "GEMINI" ? "gemini-test" : null,
    moderationStatus,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ingredients: mapIngredientInputs(recipeInput().ingredients),
    steps: mapStepInputs(recipeInput().steps),
  };
}

function mapIngredientInputs(
  ingredients: AdminRecipeIngredientInput[],
): AdminRecipeDetailModel["ingredients"] {
  return ingredients.map((ingredient, index) => ({
    id: randomUUID(),
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
    prepNote: ingredient.prepNote,
    displayOrder: index + 1,
  }));
}

function mapStepInputs(
  steps: AdminRecipeStepInput[],
): AdminRecipeDetailModel["steps"] {
  return steps.map((step, index) => ({
    id: randomUUID(),
    displayOrder: index + 1,
    content: step.content,
    estimatedMinutes: step.estimatedMinutes,
    techniqueIcon: step.techniqueIcon,
    isTricky: step.isTricky,
    timerSeconds: step.timerSeconds,
  }));
}

function paginate<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedAdminResult<T> {
  const offset = (page - 1) * limit;
  const pageItems = items.slice(offset, offset + limit);

  return {
    items: pageItems,
    page,
    limit,
    total: items.length,
    totalPages: items.length === 0 ? 0 : Math.ceil(items.length / limit),
  };
}
