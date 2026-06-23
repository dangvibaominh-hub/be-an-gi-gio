import type { PoolClient } from "pg";

import { logger } from "../config/logger.js";
import { pool } from "./pool.js";
import { categories, cookingTerms, recipes } from "./seed-data.js";

function normalizeIngredient(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrimaryTerm(techniqueIcon: string) {
  if (techniqueIcon === "chao") return "áp chảo";
  if (techniqueIcon === "hap") return "hấp cách thủy";
  if (techniqueIcon === "tron") return "trộn đều";
  return "om nhỏ lửa";
}

function createIngredients(recipe: (typeof recipes)[number]) {
  return [
    {
      name: "Hành tím",
      amount: 2,
      unit: "củ",
      prepNote: "Hành tím: bóc vỏ, thái mỏng",
    },
    {
      name: "Tỏi",
      amount: 3,
      unit: "tép",
      prepNote: "Tỏi: bóc vỏ, băm nhỏ",
    },
    {
      name: recipe.mainIngredient,
      amount: recipe.baseAmount,
      unit: recipe.unit,
      prepNote: recipe.prepNote,
    },
    {
      name: "Gia vị cơ bản",
      amount: 1,
      unit: "phần",
      prepNote: "Chuẩn bị nước mắm, đường, tiêu và dầu ăn",
    },
  ];
}

function createSteps(recipe: (typeof recipes)[number]) {
  const primaryTerm = getPrimaryTerm(recipe.techniqueIcon);

  return [
    {
      content: `Sơ chế ${recipe.mainIngredient.toLocaleLowerCase("vi")} theo hướng dẫn. Chuẩn bị hành tím và tỏi, sau đó {{trộn đều}} cùng một nửa phần gia vị.`,
      estimatedMinutes: Math.max(
        5,
        Math.round(recipe.cookTimeMinutes * 0.25),
      ),
      isTricky: false,
      techniqueIcon: "dao",
    },
    {
      content: `Làm nóng dụng cụ nấu, {{phi thơm}} hành tỏi rồi cho ${recipe.mainIngredient.toLocaleLowerCase("vi")} vào. Thực hiện kỹ thuật {{${primaryTerm}}} đến khi nguyên liệu vừa chín.`,
      estimatedMinutes: Math.max(
        5,
        Math.round(recipe.cookTimeMinutes * 0.45),
      ),
      isTricky: recipe.difficulty !== "de",
      techniqueIcon: recipe.techniqueIcon,
    },
    {
      content:
        "Nêm phần gia vị còn lại, tiếp tục {{om nhỏ lửa}} cho thấm. Kiểm tra độ chín, tắt bếp và trình bày món ăn.",
      estimatedMinutes: Math.max(
        3,
        Math.round(recipe.cookTimeMinutes * 0.3),
      ),
      isTricky: recipe.difficulty === "kho",
      techniqueIcon: "noi",
    },
  ];
}

async function seedRecipe(
  client: PoolClient,
  recipe: (typeof recipes)[number],
  categoryIds: Map<string, string>,
  termIds: Map<string, string>,
) {
  const categoryId = categoryIds.get(recipe.category);
  if (categoryId === undefined) {
    throw new Error(`Missing category: ${recipe.category}`);
  }

  const recipeResult = await client.query<{ id: string }>(
    `INSERT INTO recipes (
       slug, title, description, image_url, image_alt, difficulty,
       cook_time_minutes, base_servings, category_id, status, source,
       moderation_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLISHED', 'SEED', 'APPROVED')
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       image_url = EXCLUDED.image_url,
       image_alt = EXCLUDED.image_alt,
       difficulty = EXCLUDED.difficulty,
       cook_time_minutes = EXCLUDED.cook_time_minutes,
       base_servings = EXCLUDED.base_servings,
       category_id = EXCLUDED.category_id,
       status = 'PUBLISHED',
       source = 'SEED',
       moderation_status = 'APPROVED',
       updated_at = NOW()
     RETURNING id`,
    [
      recipe.slug,
      recipe.title,
      `Hướng dẫn chi tiết món ${recipe.title}.`,
      recipe.image,
      recipe.imageAlt,
      recipe.difficulty,
      recipe.cookTimeMinutes,
      recipe.baseServings,
      categoryId,
    ],
  );

  const recipeId = recipeResult.rows[0]?.id;
  if (recipeId === undefined) {
    throw new Error(`Could not seed recipe: ${recipe.slug}`);
  }

  await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [
    recipeId,
  ]);
  await client.query("DELETE FROM recipe_steps WHERE recipe_id = $1", [
    recipeId,
  ]);

  for (const [index, ingredient] of createIngredients(recipe).entries()) {
    const ingredientResult = await client.query<{ id: string }>(
      `INSERT INTO ingredients (name, normalized_name)
       VALUES ($1, $2)
       ON CONFLICT (normalized_name) DO UPDATE SET
         name = EXCLUDED.name,
         updated_at = NOW()
       RETURNING id`,
      [ingredient.name, normalizeIngredient(ingredient.name)],
    );
    const ingredientId = ingredientResult.rows[0]?.id;

    await client.query(
      `INSERT INTO recipe_ingredients (
         recipe_id, ingredient_id, amount, unit, prep_note, display_order
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        recipeId,
        ingredientId,
        ingredient.amount,
        ingredient.unit,
        ingredient.prepNote,
        index,
      ],
    );
  }

  for (const [index, step] of createSteps(recipe).entries()) {
    const stepResult = await client.query<{ id: string }>(
      `INSERT INTO recipe_steps (
         recipe_id, display_order, content, estimated_minutes,
         technique_icon, is_tricky
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        recipeId,
        index + 1,
        step.content,
        step.estimatedMinutes,
        step.techniqueIcon,
        step.isTricky,
      ],
    );
    const stepId = stepResult.rows[0]?.id;
    if (stepId === undefined) {
      throw new Error(`Could not seed step for recipe: ${recipe.slug}`);
    }

    for (const term of Object.keys(cookingTerms)) {
      if (!step.content.includes(`{{${term}}}`)) {
        continue;
      }

      const termId = termIds.get(term);
      await client.query(
        `INSERT INTO recipe_step_terms (recipe_step_id, cooking_term_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [stepId, termId],
      );
    }
  }
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const categoryIds = new Map<string, string>();
    for (const category of categories) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO categories (slug, name, display_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           display_order = EXCLUDED.display_order,
           updated_at = NOW()
         RETURNING id`,
        [category.slug, category.name, category.displayOrder],
      );
      const id = result.rows[0]?.id;
      if (id !== undefined) categoryIds.set(category.name, id);
    }

    const termIds = new Map<string, string>();
    for (const [term, definition] of Object.entries(cookingTerms)) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO cooking_terms (term, definition)
         VALUES ($1, $2)
         ON CONFLICT (term) DO UPDATE SET
           definition = EXCLUDED.definition,
           updated_at = NOW()
         RETURNING id`,
        [term, definition],
      );
      const id = result.rows[0]?.id;
      if (id !== undefined) termIds.set(term, id);
    }

    for (const recipe of recipes) {
      await seedRecipe(client, recipe, categoryIds, termIds);
    }

    await client.query("COMMIT");
    logger.info(
      { categories: categories.length, recipes: recipes.length },
      "Seed completed",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void seed().catch((error: unknown) => {
  logger.fatal({ error }, "Seed failed");
  process.exitCode = 1;
});
