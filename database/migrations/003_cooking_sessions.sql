DO $$ BEGIN
  CREATE TYPE cooking_session_status AS ENUM ('IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cooking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step > 0),
  servings INTEGER NOT NULL CHECK (servings > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status cooking_session_status NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cooking_sessions_completed_at_check CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL)
    OR (status = 'IN_PROGRESS' AND completed_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cooking_sessions_active_recipe
  ON cooking_sessions(user_id, recipe_id)
  WHERE status = 'IN_PROGRESS';
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_user_completed
  ON cooking_sessions(user_id, completed_at DESC)
  WHERE status = 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_user_started
  ON cooking_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_recipe
  ON cooking_sessions(recipe_id);
