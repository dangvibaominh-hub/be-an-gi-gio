import { z } from "zod";

import { RECIPE_CATEGORIES } from "../recipes/recipe.model.js";
import type { RecommendationFilters } from "./recommendation.types.js";
import {
  geminiRecipeResponseSchema,
  generatedRecipeSchema,
  type GeneratedRecipe,
} from "./generated-recipe.schema.js";

export interface RecipeGenerationInput {
  ingredients: string[];
  filters: RecommendationFilters;
  request?: string;
  userContext?: string | null;
}

export interface RecipeGenerationAdapter {
  readonly model: string;
  generateRecipe(
    input: RecipeGenerationInput,
    options?: RecipeGenerationOptions,
  ): Promise<GeneratedRecipe | null>;
}

export interface RecipeGenerationOptions {
  signal?: AbortSignal;
}

interface GeminiRecipeGenerationAdapterOptions {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

const geminiGenerateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(
            z
              .object({
                text: z.string().optional(),
              })
              .passthrough(),
          ),
        }),
      }),
    )
    .optional(),
});

export class GeminiRecipeGenerationAdapter
  implements RecipeGenerationAdapter
{
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly models: string[];
  private readonly timeoutMs: number;

  constructor(options: GeminiRecipeGenerationAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.models = uniqueModels([
      options.model,
      ...(options.fallbackModels ?? []),
    ]);
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async generateRecipe(
    input: RecipeGenerationInput,
    options: RecipeGenerationOptions = {},
  ): Promise<GeneratedRecipe | null> {
    let lastError: unknown;

    for (const model of this.models) {
      try {
        return await this.generateRecipeWithModel(input, model, options);
      } catch (error) {
        lastError = error;

        if (
          options.signal?.aborted === true ||
          !isRetryableGeminiError(error) ||
          model === this.models.at(-1)
        ) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini recipe request failed for all configured models.");
  }

  private async generateRecipeWithModel(
    input: RecipeGenerationInput,
    model: string,
    options: RecipeGenerationOptions,
  ): Promise<GeneratedRecipe | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortFromCaller = () => controller.abort();

    if (options.signal?.aborted === true) {
      controller.abort();
    } else {
      options.signal?.addEventListener("abort", abortFromCaller, {
        once: true,
      });
    }

    try {
      const response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: buildRecipePrompt(input) }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
              responseSchema: geminiRecipeResponseSchema,
            },
          }),
        },
      );

      if (!response.ok) {
        const preview = await readGeminiErrorPreview(response);

        throw new GeminiRecipeRequestError(
          response.status,
          model,
          [
            `Gemini recipe request failed for model ${model} with status ${response.status}`,
            response.statusText.trim().length === 0 ? "" : ` ${response.statusText}`,
            preview === null ? "" : `: ${preview}`,
            ".",
          ].join(""),
        );
      }

      const payload = (await response.json()) as unknown;
      const directRecipe = generatedRecipeSchema.safeParse(payload);

      if (directRecipe.success) {
        return directRecipe.data;
      }

      const text = extractGeneratedText(payload);

      if (text === null) {
        return null;
      }

      return generatedRecipeSchema.parse(JSON.parse(stripJsonFence(text)));
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

class GeminiRecipeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly model: string,
    message: string,
  ) {
    super(message);
    this.name = "GeminiRecipeRequestError";
  }
}

function buildRecipePrompt(input: RecipeGenerationInput) {
  const ingredientText =
    input.ingredients.length === 0
      ? "Nguoi dung chua liet ke ro nguyen lieu; hay suy luan tu yeu cau tu nhien neu co."
      : `Nguyen lieu nguoi dung co: ${input.ingredients.join(", ")}.`;
  const constraints = [
    ingredientText,
    `Chi chon category trong danh sach: ${RECIPE_CATEGORIES.join(", ")}.`,
    "Tra ve duy nhat mot JSON object dung schema, khong markdown, khong giai thich them.",
    "Cong thuc phai viet bang tieng Viet tu nhien, an toan, de lam tai nha.",
    "Hay uu tien dung tat ca nguyen lieu nguoi dung dua vao; co the them gia vi/co ban neu can.",
    "Giu cong thuc gon: 5-10 nguyen lieu, 4-8 buoc; moi buoc chi 1-2 cau ro thao tac.",
    "Moi ingredient phai co amount la so duong, unit ngan gon, prepNote co the la chuoi rong.",
    "Moi step can ro thao tac, estimatedMinutes, techniqueIcon trong: dao, chao, noi, tron, hap.",
    "Khong tra ve URL anh tu Internet va khong bia nguon anh; chi viet imageAlt mo ta mon an ro rang de admin co the chon/upload anh hop le.",
  ];

  if (input.request !== undefined && input.request.trim().length > 0) {
    constraints.push(`Yeu cau tu nhien cua nguoi dung: ${input.request.trim()}.`);
  }

  if (input.userContext !== undefined && input.userContext !== null) {
    constraints.push(`Tin hieu ca nhan hoa: ${input.userContext}`);
  }

  if (input.filters.category !== undefined) {
    constraints.push(`Neu phu hop, uu tien category/filter: ${input.filters.category}.`);
  }

  if (input.filters.difficulties !== undefined) {
    constraints.push(
      `Difficulty phai nam trong: ${input.filters.difficulties.join(", ")}.`,
    );
  }

  if (input.filters.maxCookTimeMinutes !== undefined) {
    constraints.push(
      `cookTimeMinutes khong vuot qua ${input.filters.maxCookTimeMinutes}.`,
    );
  }

  if (input.filters.servings !== undefined) {
    constraints.push(`baseServings nen bang ${input.filters.servings}.`);
  }

  return [
    "Ban la dau bep Viet Nam trong he thong goi y cong thuc nau an.",
    "Hay sinh mot cong thuc moi khi database khong co mon phu hop.",
    ...constraints,
  ].join("\n");
}

function extractGeneratedText(payload: unknown) {
  const parsed = geminiGenerateContentResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  const text = parsed.data.candidates?.[0]?.content.parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text === undefined || text.length === 0 ? null : text;
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function uniqueModels(models: string[]) {
  const seen = new Set<string>();

  return models.flatMap((model) => {
    const normalized = model.trim();

    if (normalized.length === 0 || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function isRetryableGeminiError(error: unknown) {
  if (error instanceof GeminiRecipeRequestError) {
    return [404, 408, 409, 429, 500, 502, 503, 504].includes(error.status);
  }

  return error instanceof Error && error.name === "AbortError";
}

async function readGeminiErrorPreview(response: Response) {
  try {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, " ").trim();

    return normalized.length === 0 ? null : normalized.slice(0, 500);
  } catch {
    return null;
  }
}
