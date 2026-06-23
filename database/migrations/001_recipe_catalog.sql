CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE recipe_difficulty AS ENUM ('de', 'trung-binh', 'kho');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recipe_status AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recipe_source AS ENUM ('ADMIN', 'SEED', 'GEMINI');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order SMALLINT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  normalized_name VARCHAR(150) NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cooking_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term VARCHAR(120) NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  image_alt VARCHAR(250) NOT NULL,
  difficulty recipe_difficulty NOT NULL,
  cook_time_minutes INTEGER NOT NULL CHECK (cook_time_minutes > 0),
  base_servings INTEGER NOT NULL CHECK (base_servings > 0),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  status recipe_status NOT NULL DEFAULT 'PUBLISHED',
  source recipe_source NOT NULL DEFAULT 'SEED',
  ai_model VARCHAR(120),
  moderation_status moderation_status NOT NULL DEFAULT 'APPROVED',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  unit VARCHAR(50) NOT NULL,
  prep_note TEXT NOT NULL DEFAULT '',
  display_order SMALLINT NOT NULL CHECK (display_order >= 0),
  PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  display_order SMALLINT NOT NULL CHECK (display_order > 0),
  content TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes >= 0),
  technique_icon VARCHAR(30) NOT NULL
    CHECK (technique_icon IN ('dao', 'chao', 'noi', 'tron', 'hap')),
  is_tricky BOOLEAN NOT NULL DEFAULT FALSE,
  timer_seconds INTEGER CHECK (timer_seconds IS NULL OR timer_seconds > 0),
  UNIQUE (recipe_id, display_order)
);

CREATE TABLE IF NOT EXISTS recipe_step_terms (
  recipe_step_id UUID NOT NULL REFERENCES recipe_steps(id) ON DELETE CASCADE,
  cooking_term_id UUID NOT NULL REFERENCES cooking_terms(id) ON DELETE RESTRICT,
  PRIMARY KEY (recipe_step_id, cooking_term_id)
);

CREATE INDEX IF NOT EXISTS idx_categories_display_order
  ON categories(display_order, name);
CREATE INDEX IF NOT EXISTS idx_recipes_public_catalog
  ON recipes(status, moderation_status, category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_catalog_filters
  ON recipes(difficulty, cook_time_minutes, base_servings);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at
  ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingredients_normalized_name
  ON ingredients(normalized_name);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
  ON recipe_ingredients(ingredient_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_order
  ON recipe_steps(recipe_id, display_order);
