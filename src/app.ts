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
import {
  PostgresCategoryRepository,
  type CategoryRepository,
} from "./modules/categories/category.repository.js";
import { createCategoryRouter } from "./modules/categories/category.routes.js";
import {
  PostgresRecipeRepository,
  type RecipeRepository,
} from "./modules/recipes/recipe.repository.js";
import { createRecipeRouter } from "./modules/recipes/recipe.routes.js";
import { RecipeService } from "./modules/recipes/recipe.service.js";
import { indexRouter } from "./routes/index.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./shared/http/error-handler.js";

export interface AppDependencies {
  categoryRepository?: CategoryRepository;
  recipeRepository?: RecipeRepository;
}

export function createApp(dependencies: AppDependencies = {}) {
  const env = getEnv();
  const app = express();
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const categoryRepository =
    dependencies.categoryRepository ?? new PostgresCategoryRepository(pool);
  const recipeRepository =
    dependencies.recipeRepository ?? new PostgresRecipeRepository(pool);

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

  if (env.NODE_ENV !== "test") {
    const openApiPath = path.resolve("docs/openapi.yaml");
    const openApiDocument = YAML.parse(
      readFileSync(openApiPath, "utf8"),
    ) as unknown;

    if (!isJsonObject(openApiDocument)) {
      throw new Error("OpenAPI document must be a JSON object.");
    }

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use(
    "/api/v1/categories",
    createCategoryRouter(categoryRepository),
  );
  app.use(
    "/api/v1/recipes",
    createRecipeRouter(new RecipeService(recipeRepository)),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
