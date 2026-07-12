import { describe, expect, it } from "vitest";

import { RECIPE_CATEGORIES } from "../src/modules/recipes/recipe.model.js";
import { emptyFeedbackIssueCounts } from "../src/modules/feedback/feedback.model.js";
import type { RecipeGenerationAdapter } from "../src/modules/recommendations/gemini-recipe.adapter.js";
import type { PersonalizationRepository } from "../src/modules/feedback/feedback.repository.js";
import type {
  GeneratedRecipeRepository,
  RecommendationCandidate,
  RecommendationCandidateIngredient,
  RecommendationRepository,
  SaveGeneratedRecipeInput,
} from "../src/modules/recommendations/recommendation.repository.js";
import { RecommendationService } from "../src/modules/recommendations/recommendation.service.js";
import type { SavedRecipeRepository } from "../src/modules/saved-recipes/saved-recipe.repository.js";

const baseCandidates: RecommendationCandidate[] = [
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
];

const recommendationRepository = createRecommendationRepository(baseCandidates);

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

function createRecommendationRepository(
  candidates: RecommendationCandidate[],
): RecommendationRepository {
  return {
    listCandidates() {
      return Promise.resolve(candidates);
    },
    listIngredientVocabulary() {
      return Promise.resolve(createIngredientVocabulary(candidates));
    },
  };
}

function createIngredientVocabulary(candidates: RecommendationCandidate[]) {
  const ingredients = new Map<string, RecommendationCandidateIngredient>();

  for (const candidate of candidates) {
    for (const ingredient of candidate.ingredients) {
      ingredients.set(ingredient.id, ingredient);
    }
  }

  return Array.from(ingredients.values());
}

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

  it("matches ingredients by exact normalized name or alias only", async () => {
    const fishCandidates: RecommendationCandidate[] = [
          {
            id: "recipe-fish",
            slug: "ca-hap",
            title: "Ca Hap",
            description: "Mon ca hap don gian.",
            image: "/images/recipes/ca-hap.png",
            imageAlt: "Ca hap",
            difficulty: "de",
            cookTimeMinutes: 20,
            baseServings: 2,
            category: RECIPE_CATEGORIES[3],
            ingredients: [
              {
                id: "ingredient-fish",
                name: "Ca",
                normalizedName: "ca",
                aliases: [],
              },
            ],
          },
          {
            id: "recipe-snakehead",
            slug: "ca-loc-hap",
            title: "Ca Loc Hap",
            description: "Mon ca loc hap.",
            image: "/images/recipes/ca-loc-hap.png",
            imageAlt: "Ca loc hap",
            difficulty: "de",
            cookTimeMinutes: 25,
            baseServings: 2,
            category: RECIPE_CATEGORIES[3],
            ingredients: [
              {
                id: "ingredient-snakehead",
                name: "Ca loc",
                normalizedName: "ca loc",
                aliases: ["ca qua"],
              },
            ],
          },
          {
            id: "recipe-shark",
            slug: "ca-map-nuong",
            title: "Ca Map Nuong",
            description: "Mon ca map nuong.",
            image: "/images/recipes/ca-map-nuong.png",
            imageAlt: "Ca map nuong",
            difficulty: "trung-binh",
            cookTimeMinutes: 35,
            baseServings: 3,
            category: RECIPE_CATEGORIES[3],
            ingredients: [
              {
                id: "ingredient-shark",
                name: "Ca map",
                normalizedName: "ca map",
                aliases: [],
              },
            ],
          },
          {
            id: "recipe-crocodile",
            slug: "thit-ca-sau-nuong",
            title: "Thit Ca Sau Nuong",
            description: "Mon thit ca sau nuong.",
            image: "/images/recipes/thit-ca-sau-nuong.png",
            imageAlt: "Thit ca sau nuong",
            difficulty: "trung-binh",
            cookTimeMinutes: 35,
            baseServings: 3,
            category: RECIPE_CATEGORIES[3],
            ingredients: [
              {
                id: "ingredient-crocodile",
                name: "Ca sau",
                normalizedName: "ca sau",
                aliases: [],
              },
            ],
          },
    ];
    const fishRepository = createRecommendationRepository(fishCandidates);
    const service = new RecommendationService(fishRepository, 0.55);

    const genericFishResult = await service.recommend({
      ingredients: ["ca"],
      filters: {},
      page: 1,
      limit: 12,
    });
    const snakeheadResult = await service.recommend({
      ingredients: ["ca loc"],
      filters: {},
      page: 1,
      limit: 12,
    });
    const snakeheadAliasResult = await service.recommend({
      ingredients: ["ca qua"],
      filters: {},
      page: 1,
      limit: 12,
    });
    const sharkResult = await service.recommend({
      ingredients: ["ca map"],
      filters: {},
      page: 1,
      limit: 12,
    });
    const crocodileResult = await service.recommend({
      ingredients: ["ca sau"],
      filters: {},
      page: 1,
      limit: 12,
    });

    expect(genericFishResult.items.map((item) => item.slug)).toEqual(["ca-hap"]);
    expect(snakeheadResult.items.map((item) => item.slug)).toEqual(["ca-loc-hap"]);
    expect(snakeheadAliasResult.items.map((item) => item.slug)).toEqual([
      "ca-loc-hap",
    ]);
    expect(sharkResult.items.map((item) => item.slug)).toEqual(["ca-map-nuong"]);
    expect(crocodileResult.items.map((item) => item.slug)).toEqual([
      "thit-ca-sau-nuong",
    ]);
  });

  it("distinguishes avocado from beef when Vietnamese tone marks differ", async () => {
    const avocadoCandidates: RecommendationCandidate[] = [
      {
        id: "recipe-beef",
        slug: "bo-xao-hanh-tay",
        title: "Bò xào hành tây",
        description: "Món bò xào nhanh cho bữa cơm.",
        image: "/images/recipes/bo-xao-hanh-tay.png",
        imageAlt: "Đĩa bò xào hành tây",
        difficulty: "de",
        cookTimeMinutes: 20,
        baseServings: 2,
        category: RECIPE_CATEGORIES[0],
        ingredients: [
          {
            id: "ingredient-beef",
            name: "Thịt bò",
            normalizedName: "thit bo",
            aliases: ["bo"],
          },
        ],
      },
      {
        id: "recipe-avocado",
        slug: "sinh-to-bo",
        title: "Sinh tố bơ",
        description: "Sinh tố bơ mịn béo cho món tráng miệng.",
        image: "/images/recipes/sinh-to-bo.png",
        imageAlt: "Ly sinh tố bơ xanh mịn",
        difficulty: "de",
        cookTimeMinutes: 10,
        baseServings: 2,
        category: RECIPE_CATEGORIES[5],
        ingredients: [
          {
            id: "ingredient-avocado",
            name: "Bơ sáp",
            normalizedName: "bo sap",
            aliases: ["avocado"],
          },
        ],
      },
    ];
    const service = new RecommendationService(
      createRecommendationRepository(avocadoCandidates),
      0.55,
    );

    const avocadoResult = await service.recommend({
      ingredients: ["bơ"],
      filters: {},
      page: 1,
      limit: 12,
    });
    const beefResult = await service.recommend({
      ingredients: ["bò"],
      filters: {},
      page: 1,
      limit: 12,
    });

    expect(avocadoResult.items.map((item) => item.slug)).toEqual(["sinh-to-bo"]);
    expect(beefResult.items.map((item) => item.slug)).toEqual([
      "bo-xao-hanh-tay",
    ]);
  });

  it("rejects ingredients that are not in the ingredient vocabulary", async () => {
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

    await expect(
      service.recommend({
        ingredients: ["cá mập đại dương", "abc", "hoa bỉ ngạn xanh"],
        filters: {},
        page: 1,
        limit: 12,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "UNKNOWN_INGREDIENTS",
      message: "Có thành phần không xác định.",
      details: {
        unknownIngredients: [
          "cá mập đại dương",
          "abc",
          "hoa bỉ ngạn xanh",
        ],
      },
    });
    expect(geminiCalled).toBe(false);
  });

  it("reranks recommendations with personalization preferences", async () => {
    const personalizedCandidates: RecommendationCandidate[] = [
          {
            id: "recipe-hard",
            slug: "ga-chien-gion",
            title: "Ga Chien Gion",
            description: "Mon chien nhieu dau.",
            image: "/images/recipes/ga-chien-gion.png",
            imageAlt: "Ga chien gion",
            difficulty: "kho",
            cookTimeMinutes: 60,
            baseServings: 4,
            category: "Món chiên",
            ingredients: [
              {
                id: "ingredient-1",
                name: "Dau hu",
                normalizedName: "dau hu",
                aliases: [],
              },
            ],
          },
          {
            id: "recipe-easy",
            slug: "dau-hu-hap-hanh",
            title: "Dau Hu Hap Hanh",
            description: "Mon hap nhanh, it dau.",
            image: "/images/recipes/dau-hu-hap-hanh.png",
            imageAlt: "Dau hu hap hanh",
            difficulty: "de",
            cookTimeMinutes: 15,
            baseServings: 2,
            category: "Món hấp",
            ingredients: [
              {
                id: "ingredient-1",
                name: "Dau hu",
                normalizedName: "dau hu",
                aliases: [],
              },
              {
                id: "ingredient-2",
                name: "Hanh la",
                normalizedName: "hanh la",
                aliases: [],
              },
            ],
          },
    ];
    const personalizedRepository =
      createRecommendationRepository(personalizedCandidates);
    const personalizationRepository: PersonalizationRepository = {
      getInsight() {
        return Promise.resolve({
          feedbackCount: 5,
          averageRating: 3.4,
          confidence: 1,
          signals: {
            preferEasyRecipes: 0.08,
            preferQuickRecipes: 0.08,
            preferIngredientFit: 0.08,
            preferTechniqueGuidance: 0.08,
          },
          issueCounts: {
            ...emptyFeedbackIssueCounts(),
            "cutting-meat-hard": 5,
            "oil-splatter": 5,
            "took-longer-than-expected": 5,
            "missing-ingredients": 5,
          },
          insights: [],
          updatedAt: new Date(0).toISOString(),
        });
      },
    };
    const service = new RecommendationService(
      personalizedRepository,
      0,
      undefined,
      undefined,
      undefined,
      personalizationRepository,
    );

    const result = await service.recommend(
      {
        ingredients: ["dau hu"],
        filters: {},
        page: 1,
        limit: 12,
      },
      "user-1",
    );

    expect(result.items[0]?.slug).toBe("dau-hu-hap-hanh");
    expect(result.items[0]?.match.score).toBeGreaterThan(
      result.items[1]?.match.score ?? 0,
    );
  });

  it("generates and saves a pending Gemini recipe when database matching is empty", async () => {
    let savedInput: SaveGeneratedRecipeInput | undefined;
    const emptyRepository: RecommendationRepository = {
      listCandidates() {
        return Promise.resolve([]);
      },
      listIngredientVocabulary() {
        return Promise.resolve([
          {
            id: "ingredient-known-1",
            name: "Bi do",
            normalizedName: "bi do",
            aliases: [],
          },
          {
            id: "ingredient-known-2",
            name: "Trung",
            normalizedName: "trung",
            aliases: [],
          },
        ]);
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
          ingredientDetails: input.recipe.ingredients.map((ingredient, index) => ({
            id: `ingredient-${index + 1}`,
            name: ingredient.name,
            baseAmount: ingredient.amount,
            unit: ingredient.unit,
            prepNote: ingredient.prepNote,
            haveIt: false,
          })),
          steps: input.recipe.steps.map((step, index) => ({
            id: `step-${index + 1}`,
            content: step.content,
            estimatedMinutes: step.estimatedMinutes,
            techniqueIcon: step.techniqueIcon,
            isTricky: step.isTricky,
            timerSeconds: step.timerSeconds,
          })),
          cookingTerms: {},
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
    expect(result.items[0]?.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Bi do",
          baseAmount: 300,
          unit: "g",
        }),
      ]),
    );
    expect(result.items[0]?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: "Lam nong chao voi dau an, cho bi do vao xao mem.",
          techniqueIcon: "chao",
        }),
        expect.objectContaining({
          content: "Do trung vao, dao deu den khi trung chin va bam quanh bi.",
          techniqueIcon: "tron",
        }),
      ]),
    );
    expect(result.items[0]?.cookingTerms).toEqual({});
    expect(result.items[0]?.match).toMatchObject({
      matchedIngredients: ["bi do", "trung"],
      missingIngredients: ["Dau an"],
    });
    expect(savedInput).toMatchObject({
      aiModel: "gemini-test",
      createdBy: "user-1",
      recipe: {
        title: "Bi Do Xao Trung",
        steps: [
          {
            content: "Lam nong chao voi dau an, cho bi do vao xao mem.",
          },
          {
            content: "Do trung vao, dao deu den khi trung chin va bam quanh bi.",
          },
        ],
      },
    });
  });

  it("returns empty recommendations when Gemini fallback fails", async () => {
    const emptyRepository: RecommendationRepository = {
      listCandidates() {
        return Promise.resolve([]);
      },
      listIngredientVocabulary() {
        return Promise.resolve([
          {
            id: "ingredient-known-1",
            name: "Bi do",
            normalizedName: "bi do",
            aliases: [],
          },
        ]);
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
