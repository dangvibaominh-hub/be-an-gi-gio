ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'hard-to-follow-steps';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'taste-not-right';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'too-oily';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'not-crispy';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'pan-sticking-or-burning';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'vegetables-too-soft';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'soup-too-bland-or-salty';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'ingredients-overcooked';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'steamed-unevenly';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'fishy-smell';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'too-dry';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'too-sweet';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'texture-failed';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'temperature-control-hard';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'bland-flavor';
ALTER TYPE feedback_issue ADD VALUE IF NOT EXISTS 'lacks-protein';

ALTER TABLE user_personalization_insights
  ADD COLUMN IF NOT EXISTS issue_counts JSONB NOT NULL DEFAULT '{}'::jsonb;
