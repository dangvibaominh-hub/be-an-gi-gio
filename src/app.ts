import { readFileSync } from "node:fs";
import path from "node:path";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import type { JsonObject } from "swagger-ui-express";
import YAML from "yaml";

import { getEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { pool } from "./database/pool.js";
import { createSupabaseServerClient } from "./database/supabase.js";
import {
  PostgresAdminRepository,
  type AdminRepository,
} from "./modules/admin/admin.repository.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import {
  createRecipeImageStorage,
  type RecipeImageStorage,
} from "./modules/admin/admin-upload.js";
import {
  PostgresAuthRepository,
  type AuthRepository,
} from "./modules/auth/auth.repository.js";
import { createAuthRouter, createMeRouter } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import {
  PostgresCategoryRepository,
  SupabaseCategoryRepository,
  type CategoryRepository,
} from "./modules/categories/category.repository.js";
import { createCategoryRouter } from "./modules/categories/category.routes.js";
import {
  GeminiChatAssistantAdapter,
  type ChatAssistantAdapter,
} from "./modules/chat/gemini-chat.adapter.js";
import {
  PostgresChatRepository,
  type ChatRepository,
} from "./modules/chat/chat.repository.js";
import { createChatRouter } from "./modules/chat/chat.routes.js";
import { ChatService } from "./modules/chat/chat.service.js";
import {
  PostgresCookingSessionRepository,
  type CookingSessionRepository,
} from "./modules/cooking-sessions/cooking-session.repository.js";
import {
  createCookingHistoryRouter,
  createCookingSessionRouter,
} from "./modules/cooking-sessions/cooking-session.routes.js";
import { CookingSessionService } from "./modules/cooking-sessions/cooking-session.service.js";
import {
  PostgresFeedbackRepository,
  type FeedbackRepository,
  type PersonalizationRepository,
} from "./modules/feedback/feedback.repository.js";
import {
  createCookingFeedbackRouter,
  createPersonalizationRouter,
} from "./modules/feedback/feedback.routes.js";
import { FeedbackService } from "./modules/feedback/feedback.service.js";
import {
  PostgresRecipeRepository,
  SupabaseRecipeRepository,
  type RecipeRepository,
} from "./modules/recipes/recipe.repository.js";
import { createRecipeRouter } from "./modules/recipes/recipe.routes.js";
import { RecipeService } from "./modules/recipes/recipe.service.js";
import {
  PostgresGeneratedRecipeRepository,
  PostgresRecommendationRepository,
  SupabaseRecommendationRepository,
  type GeneratedRecipeRepository,
  type RecommendationRepository,
} from "./modules/recommendations/recommendation.repository.js";
import {
  GeminiRecipeGenerationAdapter,
  type RecipeGenerationAdapter,
} from "./modules/recommendations/gemini-recipe.adapter.js";
import { createRecommendationRouter } from "./modules/recommendations/recommendation.routes.js";
import { RecommendationService } from "./modules/recommendations/recommendation.service.js";
import {
  PostgresSavedRecipeRepository,
  type SavedRecipeRepository,
} from "./modules/saved-recipes/saved-recipe.repository.js";
import { createSavedRecipeRouter } from "./modules/saved-recipes/saved-recipe.routes.js";
import { SavedRecipeService } from "./modules/saved-recipes/saved-recipe.service.js";
import { indexRouter } from "./routes/index.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./shared/http/error-handler.js";

export interface AppDependencies {
  categoryRepository?: CategoryRepository;
  recipeRepository?: RecipeRepository;
  recommendationRepository?: RecommendationRepository;
  generatedRecipeRepository?: GeneratedRecipeRepository;
  recipeGenerationAdapter?: RecipeGenerationAdapter;
  authRepository?: AuthRepository;
  adminRepository?: AdminRepository;
  savedRecipeRepository?: SavedRecipeRepository;
  cookingSessionRepository?: CookingSessionRepository;
  feedbackRepository?: FeedbackRepository;
  chatPersonalizationRepository?: PersonalizationRepository;
  chatRepository?: ChatRepository;
  chatAssistantAdapter?: ChatAssistantAdapter;
  recipeImageStorage?: RecipeImageStorage;
}

export function createApp(dependencies: AppDependencies = {}) {
  const env = getEnv();
  const app = express();
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const supabaseClient =
    env.DATABASE_DRIVER === "supabase"
      ? createSupabaseServerClient()
      : undefined;

  const categoryRepository =
    dependencies.categoryRepository ??
    (supabaseClient === undefined
      ? new PostgresCategoryRepository(pool)
      : new SupabaseCategoryRepository(supabaseClient));
  const recipeRepository =
    dependencies.recipeRepository ??
    (supabaseClient === undefined
      ? new PostgresRecipeRepository(pool)
      : new SupabaseRecipeRepository(supabaseClient));
  const recommendationRepository =
    dependencies.recommendationRepository ??
    (supabaseClient === undefined
      ? new PostgresRecommendationRepository(pool)
      : new SupabaseRecommendationRepository(supabaseClient));
  const authRepository =
    dependencies.authRepository ?? new PostgresAuthRepository(pool);
  const adminRepository =
    dependencies.adminRepository ?? new PostgresAdminRepository(pool);
  const recipeImageStorage =
    dependencies.recipeImageStorage ??
    createRecipeImageStorage({
      bucket: env.SUPABASE_STORAGE_BUCKET,
      folder: env.SUPABASE_RECIPE_IMAGE_FOLDER,
      ...(env.SUPABASE_SERVICE_ROLE_KEY === undefined
        ? {}
        : { serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY }),
      ...(env.SUPABASE_URL === undefined ? {} : { supabaseUrl: env.SUPABASE_URL }),
    });
  const savedRecipeRepository =
    dependencies.savedRecipeRepository ??
    new PostgresSavedRecipeRepository(pool);
  const cookingSessionRepository =
    dependencies.cookingSessionRepository ??
    new PostgresCookingSessionRepository(pool);
  const feedbackRepository =
    dependencies.feedbackRepository ?? new PostgresFeedbackRepository(pool);
  const chatPersonalizationRepository =
    dependencies.chatPersonalizationRepository ??
    (env.NODE_ENV === "test" && dependencies.feedbackRepository === undefined
      ? undefined
      : feedbackRepository);
  const chatRepository =
    dependencies.chatRepository ?? new PostgresChatRepository(pool);
  const recipeGenerationAdapter =
    dependencies.recipeGenerationAdapter ??
    createRecipeGenerationAdapter(
      env.NODE_ENV,
      env.GEMINI_API_KEY,
      env.GEMINI_MODEL,
    );
  const generatedRecipeRepository =
    dependencies.generatedRecipeRepository ??
    (env.NODE_ENV === "test"
      ? undefined
      : new PostgresGeneratedRecipeRepository(pool));
  const authService = new AuthService(authRepository, {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
    ...(env.GOOGLE_OAUTH_CLIENT_ID === undefined
      ? {}
      : { googleOAuthClientId: env.GOOGLE_OAUTH_CLIENT_ID }),
  });
  const cookingSessionService = new CookingSessionService(
    cookingSessionRepository,
  );
  const feedbackService = new FeedbackService(feedbackRepository);
  const chatAssistantAdapter =
    dependencies.chatAssistantAdapter ??
    createChatAssistantAdapter(
      env.NODE_ENV,
      env.GEMINI_API_KEY,
      env.GEMINI_MODEL,
      env.CHAT_AI_TIMEOUT_MS,
    );
  const chatService = new ChatService(
    chatRepository,
    chatAssistantAdapter,
    { recipeCandidateLimit: 8 },
    chatPersonalizationRepository,
  );

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (
          origin === undefined ||
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes("*")
        ) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin không được CORS cho phép."));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.resolve("public")));
  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== "test",
      redact: ["req.headers.authorization", "req.headers.cookie"],
    }),
  );

  app.use("/", indexRouter);
  app.use("/api/v1/auth", createAuthRouter(authService));
  app.use("/api/v1/me", createMeRouter(authService));
  app.use(
    "/api/v1/admin",
    createAdminRouter(authService, adminRepository, recipeImageStorage),
  );

  const openApiDocument = loadOpenApiDocument();
  const swaggerHandler = swaggerUi.setup(openApiDocument, {
    customSiteTitle: "An Gi Gio API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  });
  const swaggerContentSecurityPolicy = helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://validator.swagger.io"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  });

  app.use(
    ["/docs", "/api-docs"],
    swaggerContentSecurityPolicy,
    swaggerUi.serve,
    swaggerHandler,
  );

  app.use(
    "/api/v1/categories",
    createCategoryRouter(categoryRepository),
  );
  app.use(
    "/api/v1/recipes",
    createRecipeRouter(new RecipeService(recipeRepository)),
  );
  app.use(
    "/api/v1/recommendations",
    createRecommendationRouter(
      new RecommendationService(
        recommendationRepository,
        env.RECOMMENDATION_MATCH_THRESHOLD,
        savedRecipeRepository,
        recipeGenerationAdapter,
        generatedRecipeRepository,
        feedbackRepository,
      ),
      authService,
    ),
  );
  app.use(
    "/api/v1/cooking-sessions",
    createCookingSessionRouter(authService, cookingSessionService),
  );
  app.use(
    "/api/v1/cooking-sessions",
    createCookingFeedbackRouter(authService, feedbackService),
  );
  app.use(
    "/api/v1/me/saved-recipes",
    createSavedRecipeRouter(
      authService,
      new SavedRecipeService(savedRecipeRepository),
    ),
  );
  app.use(
    "/api/v1/me/cooking-history",
    createCookingHistoryRouter(authService, cookingSessionService),
  );
  app.use(
    "/api/v1/me/personalization",
    createPersonalizationRouter(authService, feedbackService),
  );
  app.use(
    "/api/v1/chat/conversations",
    createChatRouter(
      authService,
      chatService,
      env.CHAT_MESSAGE_RATE_LIMIT_PER_MINUTE,
    ),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadOpenApiDocument(): JsonObject {
  const openApiPath = path.resolve("docs/openapi.yaml");
  const openApiDocument = YAML.parse(
    readFileSync(openApiPath, "utf8"),
  ) as unknown;

  if (!isJsonObject(openApiDocument)) {
    throw new Error("OpenAPI document must be a JSON object.");
  }

  return openApiDocument;
}

function createRecipeGenerationAdapter(
  nodeEnv: "development" | "test" | "production",
  apiKey: string | undefined,
  model: string | undefined,
) {
  if (nodeEnv === "test" || apiKey === undefined || model === undefined) {
    return undefined;
  }

  return new GeminiRecipeGenerationAdapter({
    apiKey,
    model,
  });
}

function createChatAssistantAdapter(
  nodeEnv: "development" | "test" | "production",
  apiKey: string | undefined,
  model: string | undefined,
  timeoutMs: number,
) {
  if (nodeEnv === "test" || apiKey === undefined || model === undefined) {
    return undefined;
  }

  return new GeminiChatAssistantAdapter({
    apiKey,
    model,
    timeoutMs,
  });
}
