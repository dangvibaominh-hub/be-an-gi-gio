import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type { RecipeRepository } from "../src/modules/recipes/recipe.repository.js";
import type { RecipeDetailModel } from "../src/modules/recipes/recipe.model.js";
import type {
  RecipeListQuery,
} from "../src/modules/recipes/recipe.types.js";

const recipe: RecipeDetailModel = {
  id: "5a07bed2-16ac-45f7-82a0-5fab7fbc07cf",
  slug: "rau-muong-xao-toi",
  title: "Rau Muống Xào Tỏi",
  description: "Hướng dẫn chi tiết món Rau Muống Xào Tỏi.",
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
      baseAmount: 500,
      unit: "g",
      prepNote: "Nhặt sạch và để ráo",
      haveIt: false,
    },
  ],
  steps: [
    {
      id: "f35de90a-6f02-46b0-99e1-3744ab29904d",
      content: "{{Phi thơm}} tỏi rồi cho rau vào xào.",
      estimatedMinutes: 5,
      isTricky: false,
      techniqueIcon: "chao",
      timerSeconds: null,
    },
  ],
  cookingTerms: {
    "phi thơm": "Đảo hành hoặc tỏi trong dầu đến khi dậy mùi.",
  },
};

class FakeRecipeRepository implements RecipeRepository {
  lastQuery: RecipeListQuery | undefined;

  list(query: RecipeListQuery) {
    this.lastQuery = query;
    return Promise.resolve({
      items: [recipe],
      page: query.page,
      limit: query.limit,
      total: 1,
      totalPages: 1,
    });
  }

  findBySlug(slug: string) {
    return Promise.resolve(slug === recipe.slug ? recipe : null);
  }
}

const categoryRepository: CategoryRepository = {
  list() {
    return Promise.resolve([
      {
        id: "864f85b1-f03b-41c0-8d3b-e783c071f84c",
        slug: "mon-xao",
        name: "Món xào",
      },
    ]);
  },
};

function createTestApp() {
  const recipeRepository = new FakeRecipeRepository();
  return {
    app: createApp({ categoryRepository, recipeRepository }),
    recipeRepository,
  };
}

describe("Recipe catalog API", () => {
  it("returns categories", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/v1/categories");

    expect(response.status).toBe(200);
    const body = response.body as {
      data: Array<{ slug: string; name: string }>;
    };
    expect(body.data[0]).toMatchObject({
      slug: "mon-xao",
      name: "Món xào",
    });
  });

  it("validates and forwards recipe filters", async () => {
    const { app, recipeRepository } = createTestApp();
    const response = await request(app).get(
      "/api/v1/recipes?page=2&limit=6&category=mon-xao&difficulty=de&maxCookTimeMinutes=30&servings=4",
    );

    expect(response.status).toBe(200);
    expect(recipeRepository.lastQuery).toEqual({
      page: 2,
      limit: 6,
      category: "mon-xao",
      difficulties: ["de"],
      maxCookTimeMinutes: 30,
      servings: 4,
      sort: "difficulty-asc",
    });
    const body = response.body as {
      meta: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(body.meta).toEqual({
      page: 2,
      limit: 6,
      total: 1,
      totalPages: 1,
    });
  });

  it("rejects invalid pagination", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/v1/recipes?page=0");

    expect(response.status).toBe(400);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns recipe detail by slug", async () => {
    const { app } = createTestApp();
    const response = await request(app).get(
      "/api/v1/recipes/rau-muong-xao-toi",
    );

    expect(response.status).toBe(200);
    const body = response.body as { data: RecipeDetailModel };
    expect(body.data).toMatchObject({
      slug: recipe.slug,
      title: recipe.title,
      ingredients: recipe.ingredients,
    });
  });

  it("returns a stable 404 response for a missing recipe", async () => {
    const { app } = createTestApp();
    const response = await request(app).get(
      "/api/v1/recipes/khong-ton-tai",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "RECIPE_NOT_FOUND",
        message: "Không tìm thấy công thức này.",
      },
    });
  });
});
