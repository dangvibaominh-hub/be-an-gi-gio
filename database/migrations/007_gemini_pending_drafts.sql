UPDATE recipes
SET status = 'DRAFT',
    updated_at = NOW()
WHERE source = 'GEMINI'
  AND moderation_status = 'PENDING'
  AND status = 'PUBLISHED';
