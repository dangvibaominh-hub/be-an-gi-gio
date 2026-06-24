import { describe, expect, it } from "vitest";

import { RECIPE_CATEGORIES } from "../src/modules/recipes/recipe.model.js";
import type { RecipeGenerationAdapter } from "../src/modules/recommendations/gemini-recipe.adapter.js";
import type { RecommendationRepository } from "../src/modules/recommendations/recommendation.repository.js";
import type {
  GeneratedRecipeRepository,
  SaveGeneratedRecipeInput,
} from "../src/modules/recommendations/recommendation.repository.js";
import { RecommendationService } from "../src/modules/recommendations/recommendation.service.js";
import type { SavedRecipeRepository } from "../src/modules/saved-recipes/saved-recipe.repository.js";

const recommendationRepository: RecommendationRepository = {
  listCandidates() {
    return Promise.resolve([
      {
        id: "recipe-1",
        slug: "rau-muong-xao-toi",
        title: "Rau Muống Xào Tỏi",
        description: "Rau muống xào nhanh với tỏi.",
        image: "/images/recipes/rau-muong-xao-toi.png",
        imageAlt: "Rau muống xanh xào tỏi",
        difficulty: "de",
        cookTimeMinutes: 10,
        baseServings: 4,
        category: "Món xào",
        ingredients: [
          {
            id: "ingredient-1",
            name: "Rau muống",
            normalizedName: "rau muong",
            aliases: [],
          },
          {
            id: "ingredient-2",
            name: "Tỏi",
            normalizedName: "toi",
            aliases: [],
          },
        ],
      },
    ]);
  },
};

const savedRecipeRepository: SavedRecipeRepository = {
  list() {
    return Promise.resolve([
      {
        id: "recipe-1",
        slug: "rau-muong-xao-toi",
        title: "Rau Muống Xào Tỏi",
        description: "Rau muống xào nhanh với tỏi.",
        image: "/images/recipes/rau-muong-xao-toi.png",
        imageAlt: "Rau muống xanh xào tỏi",
        difficulty: "de",
        cookTimeMinutes: 10,
        baseServings: 4,
        category: "Món xào",
        savedAt: new Date(0).toISOString(),
      },
    ]);
  },
  save() {
    return Promise.resolve(null);
  },
  remove() {
    return Promise.resolve(false);
  },
};

describe("RecommendationService", () => {
  it("boosts saved recipes when a user is authenticated", async () => {
    const service = new RecommendationService(
      recommendationRepository,
      0,
      savedRecipeRepository,
    );

    const result = await service.recommend(
      {
        ingredients: ["rau muống"],
        filters: {},
        page: 1,
        limit: 12,
      },
      "user-1",
    );

    expect(result.items[0]?.match.score).toBe(0.9);
  });

  it("does not call Gemini when database matches the threshold", async () => {
    let geminiCalled = false;
    const recipeGenerationAdapter: RecipeGenerationAdapter = {
      model: "gemini-test",
      generateRecipe() {
        geminiCalled = true;
        return Promise.resolve(null);
      },
    };
    const service = new RecommendationService(
      recommendationRepository,
      0.55,
      undefined,
      recipeGenerationAdapter,
    );

    const result = await service.recommend({
      ingredients: ["rau muong", "toi"],
      filters: {},
      page: 1,
      limit: 12,
    });

    expect(result.source).toBe("database");
    expect(geminiCalled).toBe(false);
  });

  it("generates and saves a pending Gemini recipe when database matching is empty", async () => {
    let savedInput: SaveGeneratedRecipeInput | undefined;
    const emptyRepository: RecommendationRepository = {
      listCandidates() {
        return Promise.resolve([]);
      },
    };
    const recipeGenerationAdapter: RecipeGenerationAdapter = {
      model: "gemini-test",
      generateRecipe() {
        return Promise.resolve({
          title: "Bi Do Xao Trung",
          description: "Mon xao nhanh tu bi do va trung cho bua com nha.",
          imageAlt: "Dia bi do xao trung vang ong",
          difficulty: "de",
          cookTimeMinutes: 15,
          baseServings: 2,
          category: RECIPE_CATEGORIES[0],
          ingredients: [
            { name: "Bi do", amount: 300, unit: "g", prepNote: "Thai lat mong" },
            { name: "Trung", amount: 2, unit: "qua", prepNote: "Danh tan" },
            { name: "Dau an", amount: 1, unit: "muong canh", prepNote: "" },
          ],
          steps: [
            {
              content: "Lam nong chao voi dau an, cho bi do vao xao mem.",
              estimatedMinutes: 7,
              techniqueIcon: "chao",
              isTricky: false,
              timerSeconds: null,
            },
            {
              content: "Do trung vao, dao deu den khi trung chin va bam quanh bi.",
              estimatedMinutes: 5,
              techniqueIcon: "tron",
              isTricky: false,
              timerSeconds: null,
            },
          ],
        });
      },
    };
    const generatedRecipeRepository: GeneratedRecipeRepository = {
      save(input) {
        savedInput = input;
        return Promise.resolve({
          id: "generated-1",
          slug: input.slug,
          title: input.recipe.title,
          description: input.recipe.description,
          image: "/images/recipes/gemini-generated.png",
          imageAlt: input.recipe.imageAlt,
          difficulty: input.recipe.difficulty,
          cookTimeMinutes: input.recipe.cookTimeMinutes,
          baseServings: input.recipe.baseServings,
          category: input.recipe.category,
          ingredients: [
            {
              id: "ingredient-1",
              name: "Bi do",
              normalizedName: "bi do",
              aliases: [],
            },
            {
              id: "ingredient-2",
              name: "Trung",
              normalizedName: "trung",
              aliases: [],
            },
            {
              id: "ingredient-3",
              name: "Dau an",
              normalizedName: "dau an",
              aliases: [],
            },
          ],
        });
      },
    };
    const service = new RecommendationService(
      emptyRepository,
      0.55,
      undefined,
      recipeGenerationAdapter,
      generatedRecipeRepository,
    );

    const result = await service.recommend(
      {
        ingredients: ["bi do", "trung"],
        filters: {},
        page: 1,
        limit: 12,
      },
      "user-1",
    );

    expect(result.source).toBe("gemini");
    expect(result.total).toBe(1);
    expect(result.items[0]?.slug.startsWith("gemini-")).toBe(true);
    expect(result.items[0]).toMatchObject({
      match: {
        matchedIngredients: ["bi do", "trung"],
        missingIngredients: ["Dau an"],
      },
    });
    expect(savedInput).toMatchObject({
      aiModel: "gemini-test",
      createdBy: "user-1",
      recipe: {
        title: "Bi Do Xao Trung",
      },
    });
  });

  it("returns empty recommendations when Gemini fallback fails", async () => {
    const emptyRepository: RecommendationRepository = {
      listCandidates() {
        return Promise.resolve([]);
      },
    };
    const recipeGenerationAdapter: RecipeGenerationAdapter = {
      model: "gemini-test",
      generateRecipe() {
        return Promise.reject(new Error("Gemini unavailable"));
      },
    };
    const service = new RecommendationService(
      emptyRepository,
      0.55,
      undefined,
      recipeGenerationAdapter,
    );

    const result = await service.recommend({
      ingredients: ["bi do"],
      filters: {},
      page: 1,
      limit: 12,
    });

    expect(result).toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
      source: "empty",
    });
  });
});
