import { describe, expect, it } from "vitest";

import { RECIPE_CATEGORIES } from "../src/modules/recipes/recipe.model.js";
import { GeminiRecipeGenerationAdapter } from "../src/modules/recommendations/gemini-recipe.adapter.js";

describe("GeminiRecipeGenerationAdapter", () => {
  it("requests JSON output and validates the generated recipe", async () => {
    let requestBody: unknown;
    const generatedRecipe = {
      title: "Bi Do Xao Trung",
      description: "Mon xao nhanh tu bi do va trung cho bua com nha.",
      imageAlt: "Dia bi do xao trung vang ong",
      difficulty: "de",
      cookTimeMinutes: 15,
      baseServings: 2,
      category: RECIPE_CATEGORIES[0],
      ingredients: [
        { name: "Bi do", amount: 300, unit: "g", prepNote: "Thai lat" },
        { name: "Trung", amount: 2, unit: "qua", prepNote: "Danh tan" },
      ],
      steps: [
        {
          content: "Lam nong chao, cho bi do vao xao mem voi it dau.",
          estimatedMinutes: 7,
          techniqueIcon: "chao",
          isTricky: false,
          timerSeconds: null,
        },
        {
          content: "Cho trung vao dao deu den khi trung chin.",
          estimatedMinutes: 5,
          techniqueIcon: "tron",
          isTricky: false,
          timerSeconds: null,
        },
      ],
    };
    const fetchFn: typeof fetch = (_input, init) => {
      requestBody =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : undefined;

      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(generatedRecipe) }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    };
    const adapter = new GeminiRecipeGenerationAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      fetchFn,
    });

    const recipe = await adapter.generateRecipe({
      ingredients: ["bi do", "trung"],
      filters: {
        maxCookTimeMinutes: 20,
        servings: 2,
      },
    });

    expect(recipe?.title).toBe("Bi Do Xao Trung");
    expect(
      recipe?.ingredients.some((ingredient) => ingredient.name === "Bi do"),
    ).toBe(true);
    expect(requestBody).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
  });

  it("tries a fallback model when the primary model is temporarily unavailable", async () => {
    const requestedUrls: string[] = [];
    const generatedRecipe = {
      title: "Mi Trung Hanh La",
      description: "Mon mi trung hanh la nhanh gon cho bua an don gian.",
      imageAlt: "To mi trung hanh la nong",
      difficulty: "de",
      cookTimeMinutes: 12,
      baseServings: 1,
      category: RECIPE_CATEGORIES[0],
      ingredients: [
        { name: "Mi goi", amount: 1, unit: "goi", prepNote: "" },
        { name: "Trung", amount: 1, unit: "qua", prepNote: "Danh tan" },
      ],
      steps: [
        {
          content: "Nau mi voi nuoc soi den khi soi mi vua mem.",
          estimatedMinutes: 4,
          techniqueIcon: "noi",
          isTricky: false,
          timerSeconds: null,
        },
        {
          content: "Cho trung vao khuay nhe, them hanh la va nem vua an.",
          estimatedMinutes: 3,
          techniqueIcon: "tron",
          isTricky: false,
          timerSeconds: null,
        },
      ],
    };
    const fetchFn: typeof fetch = (input) => {
      const url = getRequestUrl(input);
      requestedUrls.push(url);

      if (url.includes("gemini-primary")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 503,
                message: "This model is currently experiencing high demand.",
                status: "UNAVAILABLE",
              },
            }),
            { status: 503, statusText: "Service Unavailable" },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(generatedRecipe) }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    };
    const adapter = new GeminiRecipeGenerationAdapter({
      apiKey: "test-key",
      model: "gemini-primary",
      fallbackModels: ["gemini-fallback"],
      fetchFn,
    });

    const recipe = await adapter.generateRecipe({
      ingredients: ["mi goi", "trung"],
      filters: {},
    });

    expect(recipe?.title).toBe("Mi Trung Hanh La");
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toContain("gemini-primary");
    expect(requestedUrls[1]).toContain("gemini-fallback");
  });
});

function getRequestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
