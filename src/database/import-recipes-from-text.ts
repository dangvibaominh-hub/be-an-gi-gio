import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";

type RecipeDifficulty = "de" | "trung-binh" | "kho";
type RecipeStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";
type TechniqueIcon = "dao" | "chao" | "noi" | "tron" | "hap";

interface ImportOptions {
  apply: boolean;
  filePath: string;
  imagesPath: string;
  statusOverride: RecipeStatus | undefined;
}

interface ImageFile {
  contentType: string;
  extension: string;
  path: string;
  size: number;
}

interface ImportIngredient {
  amount: number;
  name: string;
  prepNote: string;
  unit: string;
}

interface ImportStep {
  content: string;
  estimatedMinutes: number;
  isTricky: boolean;
  techniqueIcon: TechniqueIcon;
  terms: string[];
  timerSeconds: number | null;
}

interface ImportRecipe {
  baseServings: number;
  categorySlug: string;
  cookTimeMinutes: number;
  description: string;
  difficulty: RecipeDifficulty;
  imageAlt: string;
  imagePathFromText: string;
  ingredients: ImportIngredient[];
  slug: string;
  status: RecipeStatus;
  steps: ImportStep[];
  title: string;
}

interface RecipeWithImageUrl {
  imageUrl: string;
  recipe: ImportRecipe;
}

interface CategorySeed {
  displayOrder: number;
  name: string;
  slug: string;
}

interface CookingTermSeed {
  definition: string;
  term: string;
}

const defaultDesktop = path.join(process.env.USERPROFILE ?? process.cwd(), "Desktop");
const defaultFilePath = path.join(defaultDesktop, "công thức.txt");
const defaultImagesPath = path.join(defaultDesktop, "recipes");
const supportedImageExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);

const categories: CategorySeed[] = [
  { slug: "mon-xao", name: "Món xào", displayOrder: 1 },
  { slug: "mon-canh", name: "Món canh", displayOrder: 2 },
  { slug: "mon-chien", name: "Món chiên", displayOrder: 3 },
  { slug: "mon-hap", name: "Món hấp", displayOrder: 4 },
  { slug: "mon-chay", name: "Món chay", displayOrder: 5 },
  { slug: "trang-mieng", name: "Tráng miệng", displayOrder: 6 },
];

const cookingTerms: CookingTermSeed[] = [
  {
    term: "phi thơm",
    definition:
      "Cho dầu nóng rồi đảo hành, tỏi hoặc gia vị đến khi dậy mùi thơm.",
  },
  {
    term: "trộn đều",
    definition: "Đảo hoặc trộn nhẹ để nguyên liệu và gia vị phân bố đều.",
  },
  {
    term: "xào săn",
    definition:
      "Đảo nguyên liệu trên lửa vừa hoặc lớn đến khi bề mặt se lại và thấm gia vị.",
  },
  {
    term: "xào nhanh tay",
    definition:
      "Đảo nguyên liệu liên tục trên lửa lớn trong thời gian ngắn để giữ độ giòn hoặc mềm vừa.",
  },
  {
    term: "kho lửa nhỏ",
    definition:
      "Nấu liu riu ở nhiệt thấp để nguyên liệu mềm, thấm vị và nước kho sánh lại.",
  },
  {
    term: "ngập dầu",
    definition:
      "Chiên với lượng dầu đủ phủ phần lớn thực phẩm để món chín vàng đều.",
  },
  {
    term: "vàng giòn",
    definition:
      "Chiên đến khi bề mặt chuyển vàng và có độ giòn rõ rệt.",
  },
  {
    term: "hấp cách thủy",
    definition:
      "Làm chín bằng hơi nước, không để thực phẩm chạm trực tiếp vào nước.",
  },
  {
    term: "chần sơ",
    definition:
      "Cho nguyên liệu vào nước sôi trong thời gian ngắn rồi vớt ra để giữ màu và độ giòn.",
  },
  {
    term: "thắng đường",
    definition:
      "Đun đường đến khi tan chảy và chuyển màu caramel nâu cánh gián.",
  },
  {
    term: "lọc qua rây",
    definition:
      "Đổ hỗn hợp qua rây mịn để loại bỏ cặn và giúp thành phẩm mượt hơn.",
  },
  {
    term: "khuấy đều",
    definition:
      "Dùng muỗng hoặc vá đảo liên tục để nguyên liệu hòa quyện và không bị vón.",
  },
  {
    term: "xào nhuyễn",
    definition:
      "Xào nguyên liệu mềm và tơi mịn, thường dùng khi làm sốt cà chua hoặc nhân.",
  },
];

const cookingTermByName = new Map(cookingTerms.map((item) => [item.term, item]));

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = {
    apply: false,
    filePath: defaultFilePath,
    imagesPath: defaultImagesPath,
    statusOverride: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }

    if (arg === "--publish") {
      options.statusOverride = "PUBLISHED";
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--file") {
      options.filePath = readNextArg(argv, index, "--file");
      index += 1;
      continue;
    }

    if (arg.startsWith("--file=")) {
      options.filePath = arg.slice("--file=".length);
      continue;
    }

    if (arg === "--images") {
      options.imagesPath = readNextArg(argv, index, "--images");
      index += 1;
      continue;
    }

    if (arg.startsWith("--images=")) {
      options.imagesPath = arg.slice("--images=".length);
      continue;
    }

    if (arg === "--status") {
      options.statusOverride = parseStatus(readNextArg(argv, index, "--status"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--status=")) {
      options.statusOverride = parseStatus(arg.slice("--status=".length));
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function readNextArg(argv: string[], index: number, optionName: string) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function printHelp() {
  console.log(`Import recipes from a text file.

Usage:
  npm run recipes:import
  npm run recipes:import -- --apply
  npm run recipes:import -- --apply --status PUBLISHED
  npm run recipes:import -- --file "C:\\path\\công thức.txt" --images "C:\\path\\recipes"

Defaults:
  --file   ${defaultFilePath}
  --images ${defaultImagesPath}

Options:
  --dry-run            Parse and validate only. This is the default.
  --apply              Upload images to Supabase Storage and upsert database rows.
  --publish            Shortcut for --status PUBLISHED.
  --status <status>    DRAFT, PUBLISHED, or HIDDEN. Overrides status in the text file.
`);
}

function parseStatus(value: string): RecipeStatus {
  const status = value.trim().toUpperCase();
  if (status === "DRAFT" || status === "PUBLISHED" || status === "HIDDEN") {
    return status;
  }

  throw new Error(`Invalid recipe status: ${value}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [recipes, imageIndex] = await Promise.all([
    loadRecipes(options.filePath, options.statusOverride),
    loadImageIndex(options.imagesPath),
  ]);

  validateImportInput(recipes, imageIndex);
  printSummary(recipes, imageIndex, options);

  if (!options.apply) {
    console.log("Dry run complete. Re-run with --apply to upload images and write DB.");
    return;
  }

  const recipesWithImages = await uploadImages(recipes, imageIndex);
  await importRecipes(recipesWithImages);
  console.log(`Imported ${recipes.length} recipes successfully.`);
}

async function loadRecipes(
  filePath: string,
  statusOverride: RecipeStatus | undefined,
) {
  const text = await readFile(filePath, "utf8");
  const blocks = splitRecipeBlocks(text);
  const recipes = blocks.map((block, index) =>
    parseRecipeBlock(block, index + 1, statusOverride),
  );
  const slugCounts = countBy(recipes.map((recipe) => recipe.slug));
  const duplicateSlugs = Array.from(slugCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug);

  if (duplicateSlugs.length > 0) {
    throw new Error(`Duplicate recipe slugs: ${duplicateSlugs.join(", ")}`);
  }

  return recipes;
}

function splitRecipeBlocks(text: string) {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of normalizedText.split("\n")) {
    if (isLabelLine(line, "ten mon")) {
      if (current.length > 0) {
        blocks.push(current);
      }

      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  if (blocks.length === 0) {
    throw new Error("No recipes found in text file.");
  }

  return blocks;
}

function parseRecipeBlock(
  block: string[],
  recipeNumber: number,
  statusOverride: RecipeStatus | undefined,
): ImportRecipe {
  const fields = extractFields(block);
  const ingredientsIndex = findSectionIndex(block, "nguyen lieu");
  const stepsIndex = findSectionIndex(block, "cac buoc nau");

  if (ingredientsIndex === -1) {
    throw new Error(`Recipe #${recipeNumber} is missing Nguyen lieu section.`);
  }

  if (stepsIndex === -1) {
    throw new Error(`Recipe #${recipeNumber} is missing Cac buoc nau section.`);
  }

  if (stepsIndex <= ingredientsIndex) {
    throw new Error(`Recipe #${recipeNumber} has invalid section order.`);
  }

  const slug = requireField(fields, "slug", recipeNumber);
  const parsedStatus =
    statusOverride ??
    parseStatus(fields.get("trang thai de xuat") ?? fields.get("status") ?? "DRAFT");
  const rawIngredientLines = block.slice(ingredientsIndex + 1, stepsIndex);
  const rawStepLines = block.slice(stepsIndex + 1);

  return {
    baseServings: parsePositiveInteger(
      requireField(fields, "khau phan", recipeNumber),
      `Recipe ${slug} khau phan`,
    ),
    categorySlug: requireField(fields, "danh muc", recipeNumber),
    cookTimeMinutes: parseMinutes(
      requireField(fields, "thoi gian nau", recipeNumber),
      `Recipe ${slug} thoi gian nau`,
    ),
    description: requireField(fields, "mo ta", recipeNumber),
    difficulty: parseDifficulty(requireField(fields, "do kho", recipeNumber)),
    imageAlt: requireField(fields, "mo ta anh", recipeNumber),
    imagePathFromText: requireField(fields, "anh", recipeNumber),
    ingredients: parseIngredients(rawIngredientLines, slug),
    slug,
    status: parsedStatus,
    steps: parseSteps(rawStepLines, slug),
    title: requireField(fields, "ten mon", recipeNumber),
  };
}

function extractFields(lines: string[]) {
  const fields = new Map<string, string>();

  for (const line of lines) {
    const parsed = parseLabelLine(line);
    if (parsed === null || fields.has(parsed.label)) {
      continue;
    }

    fields.set(parsed.label, parsed.value);
  }

  return fields;
}

function parseIngredients(lines: string[], slug: string) {
  const ingredients = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index): ImportIngredient => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 4) {
        throw new Error(`Recipe ${slug} ingredient #${index + 1} is invalid.`);
      }

      const [name, amountText, unit, ...prepParts] = parts;
      if (name === undefined || amountText === undefined || unit === undefined) {
        throw new Error(`Recipe ${slug} ingredient #${index + 1} is incomplete.`);
      }

      return {
        amount: parsePositiveNumber(amountText, `Recipe ${slug} ingredient ${name}`),
        name,
        prepNote: normalizeValue(prepParts.join(" | ")) === "khong co"
          ? ""
          : prepParts.join(" | "),
        unit,
      };
    });

  if (ingredients.length === 0) {
    throw new Error(`Recipe ${slug} has no ingredients.`);
  }

  return ingredients;
}

function parseSteps(lines: string[], slug: string) {
  const stepLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const steps: ImportStep[] = [];
  let index = 0;

  while (index < stepLines.length) {
    const contentLine = stepLines[index];
    if (contentLine === undefined || isLabelLine(contentLine, "cooking terms")) {
      break;
    }

    if (isStepMetadataLine(contentLine)) {
      throw new Error(`Recipe ${slug} has a step without content near: ${contentLine}`);
    }

    index += 1;
    const timeLine = readStepMetadata(stepLines, index, "thoi gian", slug);
    index += 1;
    const iconLine = readStepMetadata(stepLines, index, "icon ky thuat", slug);
    index += 1;
    const trickyLine = readStepMetadata(stepLines, index, "can chu y", slug);
    index += 1;
    const timerLine = readStepMetadata(stepLines, index, "hen gio", slug);
    index += 1;

    const annotated = annotateCookingTerms(stripStepNumber(contentLine));
    steps.push({
      content: annotated.content,
      estimatedMinutes: parseMinutes(timeLine.value, `Recipe ${slug} step time`),
      isTricky: parseVietnameseBoolean(trickyLine.value, `Recipe ${slug} can chu y`),
      techniqueIcon: parseTechniqueIcon(iconLine.value),
      terms: annotated.terms,
      timerSeconds: parseTimerSeconds(timerLine.value, `Recipe ${slug} hen gio`),
    });
  }

  if (steps.length === 0) {
    throw new Error(`Recipe ${slug} has no steps.`);
  }

  return steps;
}

function readStepMetadata(
  lines: string[],
  index: number,
  expectedLabel: string,
  slug: string,
) {
  const line = lines[index];
  const parsed = line === undefined ? null : parseLabelLine(line);

  if (parsed === null || parsed.label !== expectedLabel) {
    throw new Error(
      `Recipe ${slug} step metadata expected ${expectedLabel}, got ${line ?? "EOF"}.`,
    );
  }

  return parsed;
}

function isStepMetadataLine(line: string) {
  const parsed = parseLabelLine(line);
  return (
    parsed !== null &&
    ["can chu y", "hen gio", "icon ky thuat", "thoi gian"].includes(parsed.label)
  );
}

function annotateCookingTerms(content: string) {
  let annotated = content;
  const terms = new Set<string>();
  const sortedTerms = [...cookingTerms].sort((left, right) =>
    right.term.length - left.term.length,
  );

  for (const item of sortedTerms) {
    const pattern = new RegExp(escapeRegExp(item.term), "giu");
    annotated = annotated.replace(pattern, () => {
      terms.add(item.term);
      return `{{${item.term}}}`;
    });
  }

  return {
    content: annotated,
    terms: Array.from(terms),
  };
}

async function loadImageIndex(imagesPath: string) {
  const files = await collectImageFiles(imagesPath);
  const imageIndex = new Map<string, ImageFile>();

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (!supportedImageExtensions.has(extension)) {
      continue;
    }

    const slug = path.basename(filePath, extension);
    if (imageIndex.has(slug)) {
      throw new Error(`Multiple images found for slug: ${slug}`);
    }

    const stats = await readFile(filePath);
    imageIndex.set(slug, {
      contentType: imageContentType(extension),
      extension: extension.slice(1),
      path: filePath,
      size: stats.length,
    });
  }

  return imageIndex;
}

async function collectImageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectImageFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function validateImportInput(
  recipes: ImportRecipe[],
  imageIndex: Map<string, ImageFile>,
) {
  const categorySlugs = new Set(categories.map((category) => category.slug));

  for (const recipe of recipes) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.slug)) {
      throw new Error(`Recipe ${recipe.title} has invalid slug: ${recipe.slug}`);
    }

    if (!categorySlugs.has(recipe.categorySlug)) {
      throw new Error(`Recipe ${recipe.slug} has invalid category: ${recipe.categorySlug}`);
    }

    if (!imageIndex.has(recipe.slug)) {
      throw new Error(`Recipe ${recipe.slug} has no matching image file.`);
    }

    const image = imageIndex.get(recipe.slug);
    if (image !== undefined && image.size > 5 * 1024 * 1024) {
      throw new Error(`Recipe ${recipe.slug} image is larger than 5MB.`);
    }
  }
}

function printSummary(
  recipes: ImportRecipe[],
  imageIndex: Map<string, ImageFile>,
  options: ImportOptions,
) {
  const terms = new Set(recipes.flatMap((recipe) =>
    recipe.steps.flatMap((step) => step.terms),
  ));
  const categoriesInFile = countBy(recipes.map((recipe) => recipe.categorySlug));

  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);
  console.log(`Recipe file: ${options.filePath}`);
  console.log(`Images folder: ${options.imagesPath}`);
  console.log(`Recipes: ${recipes.length}`);
  console.log(`Images: ${imageIndex.size}`);
  console.log(`Cooking terms used: ${terms.size}`);
  console.log(
    `Categories: ${Array.from(categoriesInFile.entries())
      .map(([category, count]) => `${category}=${count}`)
      .join(", ")}`,
  );
}

async function uploadImages(
  recipes: ImportRecipe[],
  imageIndex: Map<string, ImageFile>,
): Promise<RecipeWithImageUrl[]> {
  const { getEnv } = await import("../config/env.js");
  const env = getEnv();

  if (env.SUPABASE_URL === undefined || env.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when running --apply.",
    );
  }

  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const folder = normalizeStorageFolder(env.SUPABASE_RECIPE_IMAGE_FOLDER);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const uploadedRecipes: RecipeWithImageUrl[] = [];

  const existingBucket = await supabase.storage.getBucket(bucket);
  if (existingBucket.data === null) {
    const createdBucket = await supabase.storage.createBucket(bucket, {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      fileSizeLimit: 5 * 1024 * 1024,
      public: true,
    });

    if (createdBucket.error !== null) {
      const message = createdBucket.error.message.toLowerCase();
      if (!message.includes("already") && !message.includes("exist")) {
        throw new Error(
          `Could not create storage bucket ${bucket}: ${createdBucket.error.message}`,
        );
      }
    }

    console.log(`Storage bucket ready: ${bucket}`);
  }

  for (const recipe of recipes) {
    const image = imageIndex.get(recipe.slug);
    if (image === undefined) {
      throw new Error(`Missing image for recipe ${recipe.slug}.`);
    }

    const storagePath =
      folder.length === 0
        ? `${recipe.slug}.${image.extension}`
        : `${folder}/${recipe.slug}.${image.extension}`;
    const content = await readFile(image.path);
    const { error } = await supabase.storage.from(bucket).upload(storagePath, content, {
      cacheControl: "31536000",
      contentType: image.contentType,
      upsert: true,
    });

    if (error !== null) {
      throw new Error(`Could not upload ${recipe.slug}: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    uploadedRecipes.push({
      imageUrl: data.publicUrl,
      recipe,
    });
    console.log(`Uploaded ${recipe.slug} -> ${storagePath}`);
  }

  return uploadedRecipes;
}

async function importRecipes(recipes: RecipeWithImageUrl[]) {
  const { pool } = await import("./pool.js");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const categoryIds = await ensureCategories(client);

    for (const recipe of recipes) {
      await upsertRecipe(client, recipe, categoryIds);
      console.log(`Upserted recipe ${recipe.recipe.slug}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureCategories(client: PoolClient) {
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
    if (id === undefined) {
      throw new Error(`Could not upsert category: ${category.slug}`);
    }

    categoryIds.set(category.slug, id);
  }

  return categoryIds;
}

async function upsertRecipe(
  client: PoolClient,
  input: RecipeWithImageUrl,
  categoryIds: Map<string, string>,
) {
  const { recipe } = input;
  const categoryId = categoryIds.get(recipe.categorySlug);
  if (categoryId === undefined) {
    throw new Error(`Missing category id for ${recipe.categorySlug}.`);
  }

  const result = await client.query<{ id: string }>(
    `INSERT INTO recipes (
       slug,
       title,
       description,
       image_url,
       image_alt,
       difficulty,
       cook_time_minutes,
       base_servings,
       category_id,
       status,
       source,
       moderation_status
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6::recipe_difficulty,
       $7,
       $8,
       $9,
       $10::recipe_status,
       'ADMIN',
       'APPROVED'
     )
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       image_url = EXCLUDED.image_url,
       image_alt = EXCLUDED.image_alt,
       difficulty = EXCLUDED.difficulty,
       cook_time_minutes = EXCLUDED.cook_time_minutes,
       base_servings = EXCLUDED.base_servings,
       category_id = EXCLUDED.category_id,
       status = EXCLUDED.status,
       source = 'ADMIN',
       moderation_status = 'APPROVED',
       updated_at = NOW()
     RETURNING id`,
    [
      recipe.slug,
      recipe.title,
      recipe.description,
      input.imageUrl,
      recipe.imageAlt,
      recipe.difficulty,
      recipe.cookTimeMinutes,
      recipe.baseServings,
      categoryId,
      recipe.status,
    ],
  );
  const recipeId = result.rows[0]?.id;

  if (recipeId === undefined) {
    throw new Error(`Could not upsert recipe: ${recipe.slug}`);
  }

  await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [
    recipeId,
  ]);
  await client.query("DELETE FROM recipe_steps WHERE recipe_id = $1", [recipeId]);

  await insertIngredients(client, recipeId, recipe);
  await insertSteps(client, recipeId, recipe);
}

async function insertIngredients(
  client: PoolClient,
  recipeId: string,
  recipe: ImportRecipe,
) {
  for (const [index, ingredient] of recipe.ingredients.entries()) {
    const normalizedName = normalizeIngredientName(ingredient.name);
    const ingredientResult = await client.query<{ id: string }>(
      `INSERT INTO ingredients (name, normalized_name, aliases)
       VALUES ($1, $2, '{}')
       ON CONFLICT (normalized_name) DO UPDATE SET
         name = EXCLUDED.name,
         updated_at = NOW()
       RETURNING id`,
      [ingredient.name, normalizedName],
    );
    const ingredientId = ingredientResult.rows[0]?.id;

    if (ingredientId === undefined) {
      throw new Error(`Could not upsert ingredient: ${ingredient.name}`);
    }

    await client.query(
      `INSERT INTO recipe_ingredients (
         recipe_id,
         ingredient_id,
         amount,
         unit,
         prep_note,
         display_order
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        recipeId,
        ingredientId,
        ingredient.amount,
        ingredient.unit,
        ingredient.prepNote,
        index + 1,
      ],
    );
  }
}

async function insertSteps(
  client: PoolClient,
  recipeId: string,
  recipe: ImportRecipe,
) {
  for (const [index, step] of recipe.steps.entries()) {
    const stepResult = await client.query<{ id: string }>(
      `INSERT INTO recipe_steps (
         recipe_id,
         display_order,
         content,
         estimated_minutes,
         technique_icon,
         is_tricky,
         timer_seconds
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        recipeId,
        index + 1,
        step.content,
        step.estimatedMinutes,
        step.techniqueIcon,
        step.isTricky,
        step.timerSeconds,
      ],
    );
    const stepId = stepResult.rows[0]?.id;

    if (stepId === undefined) {
      throw new Error(`Could not insert step ${index + 1} for ${recipe.slug}.`);
    }

    for (const term of step.terms) {
      const termId = await upsertCookingTerm(client, term);
      await client.query(
        `INSERT INTO recipe_step_terms (recipe_step_id, cooking_term_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [stepId, termId],
      );
    }
  }
}

async function upsertCookingTerm(client: PoolClient, term: string) {
  const definition = cookingTermByName.get(term)?.definition;
  if (definition === undefined) {
    throw new Error(`Missing definition for cooking term: ${term}`);
  }

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

  if (id === undefined) {
    throw new Error(`Could not upsert cooking term: ${term}`);
  }

  return id;
}

function requireField(
  fields: Map<string, string>,
  fieldName: string,
  recipeNumber: number,
) {
  const value = fields.get(fieldName);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Recipe #${recipeNumber} is missing field: ${fieldName}`);
  }

  return value.trim();
}

function findSectionIndex(lines: string[], sectionName: string) {
  return lines.findIndex((line) => isLabelLine(line, sectionName));
}

function isLabelLine(line: string, expectedLabel: string) {
  const parsed = parseLabelLine(line);
  return parsed !== null && parsed.label === expectedLabel;
}

function parseLabelLine(line: string) {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  return {
    label: normalizeValue(line.slice(0, separatorIndex)),
    value: line.slice(separatorIndex + 1).trim(),
  };
}

function parseDifficulty(value: string): RecipeDifficulty {
  const normalized = value.trim();
  if (normalized === "de" || normalized === "trung-binh" || normalized === "kho") {
    return normalized;
  }

  throw new Error(`Invalid difficulty: ${value}`);
}

function parseTechniqueIcon(value: string): TechniqueIcon {
  const normalized = value.trim();
  if (
    normalized === "dao" ||
    normalized === "chao" ||
    normalized === "noi" ||
    normalized === "tron" ||
    normalized === "hap"
  ) {
    return normalized;
  }

  throw new Error(`Invalid technique icon: ${value}`);
}

function parsePositiveInteger(value: string, context: string) {
  const numberValue = Number.parseInt(value, 10);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${context} must be a positive integer.`);
  }

  return numberValue;
}

function parsePositiveNumber(value: string, context: string) {
  const normalized = value.replace(",", ".");
  const numberValue = Number.parseFloat(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`${context} amount must be a positive number.`);
  }

  return numberValue;
}

function parseMinutes(value: string, context: string) {
  const match = /(\d+)/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`${context} must include a minute number.`);
  }

  return parsePositiveInteger(match[1], context);
}

function parseVietnameseBoolean(value: string, context: string) {
  const normalized = normalizeValue(value);
  if (normalized === "co") {
    return true;
  }

  if (normalized === "khong") {
    return false;
  }

  throw new Error(`${context} must be co or khong.`);
}

function parseTimerSeconds(value: string, context: string) {
  const normalized = normalizeValue(value);
  if (normalized === "khong") {
    return null;
  }

  const match = /(\d+)/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`${context} must include seconds or khong.`);
  }

  return parsePositiveInteger(match[1], context);
}

function stripStepNumber(value: string) {
  return value.replace(/^\d+[.)]\s*/u, "").trim();
}

function imageContentType(extension: string) {
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  throw new Error(`Unsupported image extension: ${extension}`);
}

function normalizeValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeIngredientName(value: string) {
  return normalizeValue(value);
}

function normalizeStorageFolder(folder: string) {
  return folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
