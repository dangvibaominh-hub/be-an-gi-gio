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
  generateRecipe(input: RecipeGenerationInput): Promise<GeneratedRecipe | null>;
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
  private readonly modelCandidates: string[];
  private readonly timeoutMs: number;

  constructor(options: GeminiRecipeGenerationAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchFn = options.fetchFn ?? fetch;
    this.modelCandidates = createModelCandidates(
      options.model,
      options.fallbackModels ?? [],
    );
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async generateRecipe(
    input: RecipeGenerationInput,
  ): Promise<GeneratedRecipe | null> {
    let retryableError: unknown;

    for (const [index, model] of this.modelCandidates.entries()) {
      try {
        return await this.generateRecipeWithModel(input, model);
      } catch (error) {
        const hasNextModel = index < this.modelCandidates.length - 1;

        if (hasNextModel && isRetryableGeminiError(error)) {
          retryableError = error;
          continue;
        }

        throw retryableError === undefined
          ? error
          : buildGeminiFallbackError("recipe", retryableError, error);
      }
    }

    return null;
  }

  private async generateRecipeWithModel(
    input: RecipeGenerationInput,
    model: string,
  ): Promise<GeneratedRecipe | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

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
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
              responseSchema: geminiRecipeResponseSchema,
            },
          }),
        },
      );

      if (!response.ok) {
        const preview = await readGeminiErrorPreview(response);

        throw new GeminiHttpError(
          buildGeminiHttpErrorMessage("recipe", model, response, preview),
          response.status,
          model,
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
    }
  }
}

class GeminiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly model: string,
  ) {
    super(message);
    this.name = "GeminiHttpError";
  }
}

function createModelCandidates(primaryModel: string, fallbackModels: string[]) {
  return Array.from(new Set([primaryModel, ...fallbackModels]));
}

function isRetryableGeminiError(error: unknown) {
  return (
    error instanceof GeminiHttpError &&
    [429, 500, 502, 503, 504].includes(error.status)
  );
}

function buildGeminiFallbackError(
  feature: string,
  firstError: unknown,
  lastError: unknown,
) {
  return new Error(
    [
      `Gemini ${feature} request failed across configured models.`,
      `First error: ${formatErrorMessage(firstError)}`,
      `Last error: ${formatErrorMessage(lastError)}`,
    ].join(" "),
  );
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildGeminiHttpErrorMessage(
  feature: string,
  model: string,
  response: Response,
  preview: string | null,
) {
  return [
    `Gemini ${feature} request failed for model ${model} with status ${response.status}`,
    response.statusText.trim().length === 0 ? "" : ` ${response.statusText}`,
    preview === null ? "" : `: ${preview}`,
    ".",
  ].join("");
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

async function readGeminiErrorPreview(response: Response) {
  try {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, " ").trim();

    return normalized.length === 0 ? null : normalized.slice(0, 500);
  } catch {
    return null;
  }
}
