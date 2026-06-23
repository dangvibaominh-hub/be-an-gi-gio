import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/an_gi_gio"),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
