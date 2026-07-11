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
      model: "gemini-3.5-flash",
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
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
    });
  });

  it("honors an external abort signal", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const fetchFn: typeof fetch = (_input, init) => {
      requestSignal = init?.signal as AbortSignal | undefined;

      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    };
    const adapter = new GeminiRecipeGenerationAdapter({
      apiKey: "test-key",
      model: "gemini-test",
      timeoutMs: 10_000,
      fetchFn,
    });

    const promise = adapter.generateRecipe(
      {
        ingredients: ["bi do", "trung"],
        filters: {},
      },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(requestSignal?.aborted).toBe(true);
  });

  it("tries fallback models when the primary recipe model fails quickly", async () => {
    const requestedUrls: string[] = [];
    const generatedRecipe = {
      title: "Canh Trung Ca Chua",
      description: "Mon canh nhanh tu trung va ca chua cho bua com don gian.",
      imageAlt: "To canh trung ca chua nong voi mau do vang",
      difficulty: "de",
      cookTimeMinutes: 12,
      baseServings: 2,
      category: RECIPE_CATEGORIES[0],
      ingredients: [
        { name: "Trung", amount: 2, unit: "qua", prepNote: "Danh tan" },
        { name: "Ca chua", amount: 2, unit: "qua", prepNote: "Bo mui cau" },
      ],
      steps: [
        {
          content: "Phi hanh thom, cho ca chua vao xao mem voi it muoi.",
          estimatedMinutes: 5,
          techniqueIcon: "chao",
          isTricky: false,
          timerSeconds: null,
        },
        {
          content: "Them nuoc, dun soi roi ro trung vao khuay nhe den khi chin.",
          estimatedMinutes: 6,
          techniqueIcon: "noi",
          isTricky: false,
          timerSeconds: null,
        },
      ],
    };
    const fetchFn: typeof fetch = (input) => {
      const url = readFetchUrl(input);
      requestedUrls.push(url);

      if (url.includes("/gemini-primary:generateContent")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "overloaded" }), {
            status: 503,
            statusText: "Service Unavailable",
          }),
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
      timeoutMs: 10_000,
      fetchFn,
    });

    const recipe = await adapter.generateRecipe({
      ingredients: ["trung", "ca chua"],
      filters: {},
    });

    expect(requestedUrls[0]).toContain("/gemini-primary:generateContent");
    expect(requestedUrls[1]).toContain("/gemini-fallback:generateContent");
    expect(recipe?.title).toBe("Canh Trung Ca Chua");
  });
});

function readFetchUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
