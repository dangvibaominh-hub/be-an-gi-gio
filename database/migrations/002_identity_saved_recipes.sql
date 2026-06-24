DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('PASSWORD', 'GOOGLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  normalized_email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  display_name VARCHAR(120) NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'USER',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  provider auth_provider NOT NULL DEFAULT 'PASSWORD',
  google_subject VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_users_password_provider_check CHECK (
    provider <> 'PASSWORD' OR password_hash IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_recipes (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_app_users_normalized_email
  ON app_users(normalized_email);
CREATE INDEX IF NOT EXISTS idx_app_users_google_subject
  ON app_users(google_subject);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_created
  ON saved_recipes(user_id, created_at DESC);
