import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type {
  RecommendationCandidate,
  RecommendationRepository,
} from "../src/modules/recommendations/recommendation.repository.js";
import type {
  RecipeRecommendationModel,
  RecommendationFilters,
} from "../src/modules/recommendations/recommendation.types.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";

const categoryRepository: CategoryRepository = {
  list() {
    return Promise.resolve([]);
  },
};

const recipeRepository: RecipeRepository = {
  list() {
    return Promise.resolve({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    });
  },
  findBySlug() {
    return Promise.resolve(null);
  },
};

const candidates: RecommendationCandidate[] = [
  {
    id: "5a07bed2-16ac-45f7-82a0-5fab7fbc07cf",
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
        id: "973ee76b-a086-4f2c-8666-cee967b2c089",
        name: "Rau muống",
        normalizedName: "rau muong",
        aliases: [],
      },
      {
        id: "d886785d-599b-4b55-b88f-8f94299ce87b",
        name: "Tỏi",
        normalizedName: "toi",
        aliases: [],
      },
      {
        id: "92f14afd-f4d9-41cf-9b0f-df961f4a8a02",
        name: "Hành tím",
        normalizedName: "hanh tim",
        aliases: [],
      },
      {
        id: "e93fd198-05da-42ad-99d0-7fd485831f6d",
        name: "Gia vị cơ bản",
        normalizedName: "gia vi co ban",
        aliases: ["nuoc mam", "duong", "tieu", "dau an"],
      },
    ],
  },
  {
    id: "330123c7-fb3d-42fb-bfb3-f15dc2da14e8",
    slug: "chao-ga-xe-phay",
    title: "Cháo Gà Xé Phay",
    description: "Cháo gà mềm dễ ăn.",
    image: "/images/recipes/chao-ga.png",
    imageAlt: "Bát cháo gà",
    difficulty: "de",
    cookTimeMinutes: 25,
    baseServings: 3,
    category: "Món canh",
    ingredients: [
      {
        id: "d886785d-599b-4b55-b88f-8f94299ce87b",
        name: "Tỏi",
        normalizedName: "toi",
        aliases: [],
      },
      {
        id: "1e056a70-1f7a-43fd-a932-38b1b088877c",
        name: "Thịt gà",
        normalizedName: "thit ga",
        aliases: ["ga"],
      },
    ],
  },
];

class FakeRecommendationRepository implements RecommendationRepository {
  lastFilters: RecommendationFilters | undefined;

  listCandidates(filters: RecommendationFilters) {
    this.lastFilters = filters;
    return Promise.resolve(candidates);
  }
}

function createTestApp() {
  const recommendationRepository = new FakeRecommendationRepository();

  return {
    app: createApp({
      categoryRepository,
      recipeRepository,
      recommendationRepository,
    }),
    recommendationRepository,
  };
}

describe("Recommendation API", () => {
  it("returns matched and missing ingredients for recipe candidates", async () => {
    const { app, recommendationRepository } = createTestApp();

    const response = await request(app)
      .post("/api/v1/recommendations")
      .send({
        ingredients: ["Rau muống", "tỏi", "rau MUỐNG"],
        filters: {
          difficulties: ["de"],
          maxCookTimeMinutes: 30,
          servings: 4,
        },
        limit: 5,
      });

    expect(response.status).toBe(200);
    expect(recommendationRepository.lastFilters).toEqual({
      difficulties: ["de"],
      maxCookTimeMinutes: 30,
      servings: 4,
    });
    expect(response.body).toMatchObject({
      success: true,
      meta: {
        page: 1,
        limit: 5,
        total: 1,
        totalPages: 1,
        source: "database",
      },
    });
    const body = response.body as {
      data: RecipeRecommendationModel[];
    };
    expect(body.data[0]).toMatchObject({
      slug: "rau-muong-xao-toi",
      match: {
        score: 0.85,
        matchedIngredients: ["Rau muống", "tỏi"],
        missingIngredients: ["Hành tím", "Gia vị cơ bản"],
      },
    });
  });

  it("rejects an empty ingredient list", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/api/v1/recommendations")
      .send({ ingredients: [] });

    expect(response.status).toBe(400);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
