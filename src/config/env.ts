import { randomBytes } from "node:crypto";

import { config } from "dotenv";

import { z } from "zod";

config();
config({ path: ".env.local", override: true });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/an_gi_gio"),
  DATABASE_DRIVER: z.enum(["postgres", "supabase"]).optional(),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2_592_000),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  RECOMMENDATION_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  CHAT_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CHAT_MESSAGE_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(0)
    .default(20),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
}).transform((env) => {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accessSecret =
    env.JWT_ACCESS_SECRET ?? createLocalOnlySecret(env.NODE_ENV);
  const refreshSecret =
    env.JWT_REFRESH_SECRET ?? createLocalOnlySecret(env.NODE_ENV);

  return {
    ...env,
    DATABASE_DRIVER:
      env.DATABASE_DRIVER ??
      (supabaseUrl !== undefined && supabasePublishableKey !== undefined
        ? "supabase"
        : "postgres"),
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
  };
});

function createLocalOnlySecret(nodeEnv: "development" | "test" | "production") {
  if (nodeEnv === "production") {
    throw new Error("JWT secrets must be configured in production.");
  }

  return randomBytes(32).toString("hex");
}

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
