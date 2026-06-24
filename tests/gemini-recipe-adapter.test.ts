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
});
