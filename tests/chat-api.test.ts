import request from "supertest";
import type { Response } from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.model.js";
import type {
  AuthRepository,
  CreatePasswordUserInput,
  GoogleUserInput,
  RefreshTokenRecord,
  SaveRefreshTokenInput,
} from "../src/modules/auth/auth.repository.js";
import type {
  ChatConversationModel,
  ChatMessageModel,
  ChatMessageRole,
  ChatRecipeCandidateModel,
  ChatRecipeReferenceModel,
} from "../src/modules/chat/chat.model.js";
import type {
  AddChatMessageInput,
  ChatRepository,
} from "../src/modules/chat/chat.repository.js";
import type {
  ChatAssistantAdapter,
  ChatAssistantInput,
  ChatAssistantReply,
} from "../src/modules/chat/gemini-chat.adapter.js";
import type { SendChatMessageResult } from "../src/modules/chat/chat.types.js";
import {
  emptyFeedbackIssueCounts,
  emptyPersonalizationInsight,
  type PersonalizationInsightModel,
} from "../src/modules/feedback/feedback.model.js";
import type {
  PersonalizationRepository,
} from "../src/modules/feedback/feedback.repository.js";
import { RECIPE_CATEGORIES } from "../src/modules/recipes/recipe.model.js";
import type {
  RecipeGenerationAdapter,
  RecipeGenerationInput,
  RecipeGenerationOptions,
} from "../src/modules/recommendations/gemini-recipe.adapter.js";
import type {
  GeneratedRecipeRepository,
  RecommendationCandidate,
  SaveGeneratedRecipeInput,
} from "../src/modules/recommendations/recommendation.repository.js";

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
        revokedAt: new Date(),
      });
    }

    return Promise.resolve();
  }
}

class InMemoryChatRepository implements ChatRepository {
  private readonly conversations = new Map<string, ChatConversationModel>();
  private readonly messages = new Map<string, ChatMessageModel[]>();
  private conversationSequence = 1;
  private messageSequence = 1;

  constructor(
    private readonly candidates: ChatRecipeCandidateModel[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "rau-muong-xao-toi",
        title: "Rau Muống Xào Tỏi",
        description: "Món xào nhanh với rau muống và tỏi.",
        category: "Món xào",
        difficulty: "de",
        cookTimeMinutes: 10,
      },
    ],
  ) {}

  createConversation(userId: string, title: string) {
    const now = new Date().toISOString();
    const conversation: ChatConversationModel = {
      id: createUuid(this.conversationSequence++),
      userId,
      title,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return Promise.resolve(conversation);
  }

  findConversationForUser(conversationId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);

    return Promise.resolve(
      conversation?.userId === userId ? conversation : null,
    );
  }

  listMessagesForUser(conversationId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);

    if (conversation?.userId !== userId) {
      return Promise.resolve([]);
    }

    return Promise.resolve(this.messages.get(conversationId) ?? []);
  }

  addMessage(input: AddChatMessageInput) {
    const now = new Date().toISOString();
    const message: ChatMessageModel = {
      id: createUuid(this.messageSequence++ + 100),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      recipeReferences: input.recipeReferences ?? [],
      model: input.model ?? null,
      latencyMs: input.latencyMs ?? null,
      tokenCount: input.tokenCount ?? null,
      createdAt: now,
    };
    const messages = this.messages.get(input.conversationId) ?? [];
    messages.push(message);
    this.messages.set(input.conversationId, messages);
    const conversation = this.conversations.get(input.conversationId);

    if (conversation !== undefined) {
      this.conversations.set(input.conversationId, {
        ...conversation,
        updatedAt: now,
      });
    }

    return Promise.resolve(message);
  }

  listRecipeCandidates() {
    return Promise.resolve(this.candidates);
  }

  findPublicRecipesBySlugs(slugs: string[]) {
    const slugSet = new Set(slugs);
    return Promise.resolve(
      this.candidates
        .filter((candidate) => slugSet.has(candidate.slug))
        .map(toRecipeReference),
    );
  }
}

class StaticChatAssistantAdapter implements ChatAssistantAdapter {
  readonly model = "gemini-test";
  readonly inputs: ChatAssistantInput[] = [];

  constructor(private readonly reply: ChatAssistantReply) {}

  generateReply(input: ChatAssistantInput) {
    this.inputs.push(input);
    return Promise.resolve(this.reply);
  }
}

class FailingChatAssistantAdapter implements ChatAssistantAdapter {
  readonly model = "gemini-test";

  generateReply() {
    return Promise.reject(new Error("AI unavailable"));
  }
}

class InMemoryPersonalizationRepository implements PersonalizationRepository {
  constructor(
    private readonly insights = new Map<string, PersonalizationInsightModel>(),
  ) {}

  getInsight(userId: string) {
    return Promise.resolve(
      this.insights.get(userId) ?? emptyPersonalizationInsight(),
    );
  }
}

class StaticRecipeGenerationAdapter implements RecipeGenerationAdapter {
  readonly model = "gemini-recipe-test";
  readonly inputs: RecipeGenerationInput[] = [];

  generateRecipe(input: RecipeGenerationInput) {
    this.inputs.push(input);
    return Promise.resolve({
      title: "Mi Trung Hanh La",
      description: "Mon mi trung hanh la nhanh gon cho bua an don gian tai nha.",
      imageAlt: "To mi trung hanh la nong voi mau vang hap dan",
      difficulty: "de" as const,
      cookTimeMinutes: 12,
      baseServings: 1,
      category: RECIPE_CATEGORIES[0],
      ingredients: [
        { name: "Mi goi", amount: 1, unit: "goi", prepNote: "" },
        { name: "Trung", amount: 1, unit: "qua", prepNote: "Danh tan" },
        { name: "Hanh la", amount: 2, unit: "nhanh", prepNote: "Cat nho" },
      ],
      steps: [
        {
          content: "Dun soi nuoc, cho mi vao nau vua mem theo huong dan goi.",
          estimatedMinutes: 4,
          techniqueIcon: "noi" as const,
          isTricky: false,
          timerSeconds: null,
        },
        {
          content: "Do trung vao khuay nhe, them hanh la va nem lai cho vua an.",
          estimatedMinutes: 3,
          techniqueIcon: "tron" as const,
          isTricky: false,
          timerSeconds: null,
        },
      ],
    });
  }
}

class FailingRecipeGenerationAdapter implements RecipeGenerationAdapter {
  readonly model = "gemini-recipe-test";
  readonly inputs: RecipeGenerationInput[] = [];

  generateRecipe(input: RecipeGenerationInput) {
    this.inputs.push(input);
    return Promise.reject(new Error("Gemini recipe unavailable"));
  }
}

class HangingRecipeGenerationAdapter implements RecipeGenerationAdapter {
  readonly model = "gemini-recipe-test";
  readonly inputs: RecipeGenerationInput[] = [];
  abortCount = 0;

  generateRecipe(
    input: RecipeGenerationInput,
    options?: RecipeGenerationOptions,
  ): Promise<null> {
    this.inputs.push(input);
    options?.signal?.addEventListener(
      "abort",
      () => {
        this.abortCount += 1;
      },
      { once: true },
    );

    return new Promise<null>(() => undefined);
  }
}

class InMemoryGeneratedRecipeRepository implements GeneratedRecipeRepository {
  readonly inputs: SaveGeneratedRecipeInput[] = [];

  save(input: SaveGeneratedRecipeInput): Promise<RecommendationCandidate> {
    this.inputs.push(input);

    return Promise.resolve({
      id: "22222222-2222-4222-8222-222222222222",
      slug: input.slug,
      title: input.recipe.title,
      description: input.recipe.description,
      image: "/images/recipes/gemini-generated.png",
      imageAlt: input.recipe.imageAlt,
      difficulty: input.recipe.difficulty,
      cookTimeMinutes: input.recipe.cookTimeMinutes,
      baseServings: input.recipe.baseServings,
      category: input.recipe.category,
      ingredients: input.recipe.ingredients.map((ingredient, index) => ({
        id: `ingredient-${index + 1}`,
        name: ingredient.name,
        normalizedName: ingredient.name.toLocaleLowerCase("vi"),
        aliases: [],
      })),
    });
  }
}

describe("Chat API", () => {
  it("requires auth for chat conversations", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/v1/chat/conversations")
      .send({});

    expect(response.status).toBe(401);
  });

  it("creates a conversation, stores messages and filters invalid recipe references", async () => {
    const adapter = new StaticChatAssistantAdapter({
      content: "Bạn có thể thử Rau Muống Xào Tỏi cho bữa tối nhanh.",
      recipeReferences: [
        { slug: "rau-muong-xao-toi" },
        { slug: "khong-ton-tai" },
      ],
      tokenCount: 42,
    });
    const app = createTestApp({ chatAssistantAdapter: adapter });
    const token = await registerAndGetToken(app, "chat-user@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bữa tối" });
    const conversation = responseData<ChatConversationModel>(
      conversationResponse,
    );
    const conversationId = conversation.id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Tôi có rau muống và tỏi." });

    expect(sendResponse.status).toBe(201);
    const sendData = responseData<SendChatMessageResult>(sendResponse);

    expect(sendData.userMessage).toMatchObject({
      role: "user" satisfies ChatMessageRole,
      content: "Tôi có rau muống và tỏi.",
    });
    expect(sendData.assistantMessage).toMatchObject({
      role: "assistant" satisfies ChatMessageRole,
      content: "Bạn có thể thử Rau Muống Xào Tỏi cho bữa tối nhanh.",
      model: "gemini-test",
      tokenCount: 42,
    });
    expect(sendData.assistantMessage.recipeReferences).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "rau-muong-xao-toi",
        title: "Rau Muống Xào Tỏi",
      },
    ]);
    expect(adapter.inputs[0]?.recipeCandidates).toHaveLength(1);

    const messagesResponse = await request(app)
      .get(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`);

    expect(messagesResponse.status).toBe(200);
    expect(responseData<ChatMessageModel[]>(messagesResponse)).toHaveLength(2);
  });

  it("prevents users from reading or writing another user's conversation", async () => {
    const app = createTestApp();
    const ownerToken = await registerAndGetToken(app, "owner@example.com");
    const otherToken = await registerAndGetToken(app, "other@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const readResponse = await request(app)
      .get(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${otherToken}`);
    const writeResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ content: "Xin chào" });

    expect(readResponse.status).toBe(404);
    expect(writeResponse.status).toBe(404);
  });

  it("returns a fallback assistant message when AI is unavailable", async () => {
    const app = createTestApp({
      chatAssistantAdapter: new FailingChatAssistantAdapter(),
    });
    const token = await registerAndGetToken(app, "fallback@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Gợi ý món nhanh" });

    expect(sendResponse.status).toBe(201);
    const sendData = responseData<SendChatMessageResult>(sendResponse);

    expect(sendData.assistantMessage).toMatchObject({
      role: "assistant",
      model: null,
      tokenCount: null,
    });
    expect(sendData.assistantMessage.content).toContain(
      "Phụ Bếp chưa thể trả lời bạn",
    );
    expect(sendData.assistantMessage.recipeReferences).toHaveLength(1);
  });

  it("passes personalization context to Gemini from feedback insight", async () => {
    const adapter = new StaticChatAssistantAdapter({
      content: "Phu Bep se uu tien mon nhanh, de lam cho ban.",
      recipeReferences: [{ slug: "rau-muong-xao-toi" }],
    });
    const personalizationRepository = new InMemoryPersonalizationRepository(
      new Map([
        [
          "user-1",
          {
            feedbackCount: 4,
            averageRating: 3.5,
            confidence: 0.8,
            signals: {
              preferEasyRecipes: 0.04,
              preferQuickRecipes: 0.08,
              preferIngredientFit: 0.04,
              preferTechniqueGuidance: 0,
            },
            issueCounts: {
              ...emptyFeedbackIssueCounts(),
              "cutting-meat-hard": 2,
              "oil-splatter": 0,
              "took-longer-than-expected": 3,
              "missing-ingredients": 1,
            },
            insights: [
              "Ưu tiên món nhanh hơn thời gian dự kiến.",
              "Tăng ưu tiên công thức khớp nguyên liệu đang có.",
            ],
            updatedAt: "2026-07-08T00:00:00.000Z",
          },
        ],
      ]),
    );
    const app = createTestApp({
      chatAssistantAdapter: adapter,
      chatPersonalizationRepository: personalizationRepository,
    });
    const token = await registerAndGetToken(app, "context@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Toi nen nau gi nhanh?" });

    expect(sendResponse.status).toBe(201);
    expect(adapter.inputs[0]?.userContext).toContain("feedback nấu ăn");
    expect(adapter.inputs[0]?.userContext).toContain("món nấu lâu hơn dự kiến");
    expect(adapter.inputs[0]?.userContext).toContain("khớp nguyên liệu");
  });

  it("creates a pending Gemini recipe draft from an explicit chat request", async () => {
    const chatAdapter = new StaticChatAssistantAdapter({
      content: "Khong nen duoc goi khi dang tao cong thuc moi.",
      recipeReferences: [],
    });
    const recipeGenerationAdapter = new StaticRecipeGenerationAdapter();
    const generatedRecipeRepository = new InMemoryGeneratedRecipeRepository();
    const app = createTestApp({
      chatAssistantAdapter: chatAdapter,
      recipeGenerationAdapter,
      generatedRecipeRepository,
    });
    const token = await registerAndGetToken(app, "draft@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        content:
          "Tao cong thuc moi de lam voi mi goi, trung va hanh la trong 15 phut",
      });

    expect(sendResponse.status).toBe(201);
    const sendData = responseData<SendChatMessageResult>(sendResponse);

    expect(recipeGenerationAdapter.inputs).toHaveLength(1);
    expect(recipeGenerationAdapter.inputs[0]).toMatchObject({
      ingredients: ["mi goi", "trung", "hanh la"],
      filters: { difficulties: ["de"], maxCookTimeMinutes: 15 },
      request:
        "Tao cong thuc moi de lam voi mi goi, trung va hanh la trong 15 phut",
    });
    expect(generatedRecipeRepository.inputs).toHaveLength(1);
    expect(generatedRecipeRepository.inputs[0]).toMatchObject({
      aiModel: "gemini-recipe-test",
      createdBy: "user-1",
      recipe: { title: "Mi Trung Hanh La" },
    });
    expect(generatedRecipeRepository.inputs[0]?.slug).toMatch(
      /^gemini-mi-trung-hanh-la-/,
    );
    expect(sendData.assistantMessage).toMatchObject({
      role: "assistant",
      model: "gemini-recipe-test",
      tokenCount: null,
      recipeReferences: [],
    });
    expect(sendData.assistantMessage.content).toContain(
      "Mình tạo mới một công thức với",
    );
    expect(sendData.assistantMessage.content).toContain("Mi Trung Hanh La");
    expect(sendData.assistantMessage.content).toContain(
      "Chúc bạn nấu vui và ngon miệng",
    );
    expect(sendData.assistantMessage.content).not.toMatch(
      /Gemini|bản nháp|admin|placeholder|Mã bản nháp/i,
    );
    expect(chatAdapter.inputs).toHaveLength(0);
  });

  it("returns a recipe-generation fallback when Gemini recipe draft generation fails", async () => {
    const chatAdapter = new StaticChatAssistantAdapter({
      content: "Phu Bep van co the goi y mon nhanh tu mi va trung.",
      recipeReferences: [],
    });
    const recipeGenerationAdapter = new FailingRecipeGenerationAdapter();
    const generatedRecipeRepository = new InMemoryGeneratedRecipeRepository();
    const app = createTestApp({
      chatAssistantAdapter: chatAdapter,
      recipeGenerationAdapter,
      generatedRecipeRepository,
    });
    const token = await registerAndGetToken(app, "draft-fallback@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        content:
          "Tao cong thuc moi de lam voi mi goi, trung va hanh la trong 15 phut",
      });

    expect(sendResponse.status).toBe(201);
    const sendData = responseData<SendChatMessageResult>(sendResponse);

    expect(recipeGenerationAdapter.inputs).toHaveLength(1);
    expect(chatAdapter.inputs).toHaveLength(0);
    expect(generatedRecipeRepository.inputs).toHaveLength(0);
    expect(sendData.assistantMessage).toMatchObject({
      role: "assistant",
      model: null,
    });
    expect(sendData.assistantMessage.content).toContain(
      "chưa thể tạo công thức mới",
    );
    expect(sendData.assistantMessage.recipeReferences).toHaveLength(1);
  });

  it("aborts slow Gemini recipe draft generation before returning fallback", async () => {
    const chatAdapter = new StaticChatAssistantAdapter({
      content: "Khong nen duoc goi khi tao cong thuc bi treo.",
      recipeReferences: [],
    });
    const recipeGenerationAdapter = new HangingRecipeGenerationAdapter();
    const generatedRecipeRepository = new InMemoryGeneratedRecipeRepository();
    const app = createTestApp({
      chatAssistantAdapter: chatAdapter,
      recipeGenerationAdapter,
      generatedRecipeRepository,
      chatRecipeDraftTimeoutMs: 5,
    });
    const token = await registerAndGetToken(app, "draft-timeout@example.com");
    const conversationResponse = await request(app)
      .post("/api/v1/chat/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const conversationId =
      responseData<ChatConversationModel>(conversationResponse).id;

    const sendResponse = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        content:
          "Tao cong thuc moi de lam voi mi goi, trung va hanh la trong 15 phut",
      });

    expect(sendResponse.status).toBe(201);
    const sendData = responseData<SendChatMessageResult>(sendResponse);

    expect(recipeGenerationAdapter.inputs).toHaveLength(1);
    expect(recipeGenerationAdapter.abortCount).toBe(1);
    expect(chatAdapter.inputs).toHaveLength(0);
    expect(generatedRecipeRepository.inputs).toHaveLength(0);
    expect(sendData.assistantMessage).toMatchObject({
      role: "assistant",
      model: null,
    });
    expect(sendData.assistantMessage.content).toContain(
      "chưa thể tạo công thức mới",
    );
  });
});

function createTestApp(options: {
  chatAssistantAdapter?: ChatAssistantAdapter;
  chatPersonalizationRepository?: PersonalizationRepository;
  recipeGenerationAdapter?: RecipeGenerationAdapter;
  generatedRecipeRepository?: GeneratedRecipeRepository;
  chatRecipeDraftTimeoutMs?: number;
} = {}) {
  return createApp({
    authRepository: new InMemoryAuthRepository(),
    chatRepository: new InMemoryChatRepository(),
    ...(options.chatPersonalizationRepository === undefined
      ? {}
      : {
          chatPersonalizationRepository:
            options.chatPersonalizationRepository,
        }),
    ...(options.chatAssistantAdapter === undefined
      ? {}
      : { chatAssistantAdapter: options.chatAssistantAdapter }),
    ...(options.recipeGenerationAdapter === undefined
      ? {}
      : { recipeGenerationAdapter: options.recipeGenerationAdapter }),
    ...(options.generatedRecipeRepository === undefined
      ? {}
      : { generatedRecipeRepository: options.generatedRecipeRepository }),
    ...(options.chatRecipeDraftTimeoutMs === undefined
      ? {}
      : { chatRecipeDraftTimeoutMs: options.chatRecipeDraftTimeoutMs }),
  });
}

async function registerAndGetToken(app: ReturnType<typeof createApp>, email: string) {
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    displayName: "Chat User",
  });

  expect(response.status).toBe(201);
  return responseData<{ tokens: { accessToken: string } }>(response).tokens
    .accessToken;
}

function responseData<T>(response: Response): T {
  const body = response.body as unknown as { data: T };
  return body.data;
}

function createUuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function toRecipeReference(
  candidate: ChatRecipeCandidateModel,
): ChatRecipeReferenceModel {
  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
  };
}
