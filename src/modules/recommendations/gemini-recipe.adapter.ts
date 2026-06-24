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
}

export interface RecipeGenerationAdapter {
  readonly model: string;
  generateRecipe(input: RecipeGenerationInput): Promise<GeneratedRecipe | null>;
}

interface GeminiRecipeGenerationAdapterOptions {
  apiKey: string;
  model: string;
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

  constructor(options: GeminiRecipeGenerationAdapterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async generateRecipe(
    input: RecipeGenerationInput,
  ): Promise<GeneratedRecipe | null> {
    const response = await this.fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model,
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      throw new Error(`Gemini request failed with status ${response.status}.`);
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
  }
}

function buildRecipePrompt(input: RecipeGenerationInput) {
  const constraints = [
    `Nguyen lieu nguoi dung co: ${input.ingredients.join(", ")}.`,
    `Chi chon category trong danh sach: ${RECIPE_CATEGORIES.join(", ")}.`,
    "Tra ve duy nhat mot JSON object dung schema, khong markdown, khong giai thich them.",
    "Cong thuc phai viet bang tieng Viet tu nhien, an toan, de lam tai nha.",
    "Hay uu tien dung tat ca nguyen lieu nguoi dung dua vao; co the them gia vi/co ban neu can.",
    "Moi ingredient phai co amount la so duong, unit ngan gon, prepNote co the la chuoi rong.",
    "Moi step can ro thao tac, estimatedMinutes, techniqueIcon trong: dao, chao, noi, tron, hap.",
  ];

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
