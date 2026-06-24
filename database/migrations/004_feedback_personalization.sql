DO $$ BEGIN
  CREATE TYPE feedback_issue AS ENUM (
    'cutting-meat-hard',
    'oil-splatter',
    'took-longer-than-expected',
    'missing-ingredients'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cooking_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  cooking_session_id UUID NOT NULL UNIQUE REFERENCES cooking_sessions(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  issues feedback_issue[] NOT NULL DEFAULT '{}',
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_personalization_insights (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  feedback_count INTEGER NOT NULL DEFAULT 0 CHECK (feedback_count >= 0),
  average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (
    average_rating >= 0 AND average_rating <= 5
  ),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (
    confidence >= 0 AND confidence <= 1
  ),
  easy_recipe_boost NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (
    easy_recipe_boost >= 0 AND easy_recipe_boost <= 1
  ),
  quick_recipe_boost NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (
    quick_recipe_boost >= 0 AND quick_recipe_boost <= 1
  ),
  ingredient_match_boost NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (
    ingredient_match_boost >= 0 AND ingredient_match_boost <= 1
  ),
  technique_guidance_boost NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (
    technique_guidance_boost >= 0 AND technique_guidance_boost <= 1
  ),
  cutting_meat_hard_count INTEGER NOT NULL DEFAULT 0 CHECK (
    cutting_meat_hard_count >= 0
  ),
  oil_splatter_count INTEGER NOT NULL DEFAULT 0 CHECK (
    oil_splatter_count >= 0
  ),
  took_longer_than_expected_count INTEGER NOT NULL DEFAULT 0 CHECK (
    took_longer_than_expected_count >= 0
  ),
  missing_ingredients_count INTEGER NOT NULL DEFAULT 0 CHECK (
    missing_ingredients_count >= 0
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cooking_feedback_user_created
  ON cooking_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooking_feedback_recipe
  ON cooking_feedback(recipe_id);
