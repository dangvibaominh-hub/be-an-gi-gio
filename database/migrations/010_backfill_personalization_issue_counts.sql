WITH feedback_summary AS (
  SELECT
    user_id,
    COUNT(*)::integer AS feedback_count,
    ROUND(AVG(rating)::numeric, 2) AS average_rating
  FROM cooking_feedback
  GROUP BY user_id
),
issue_keys(issue) AS (
  VALUES
    ('cutting-meat-hard'),
    ('oil-splatter'),
    ('took-longer-than-expected'),
    ('missing-ingredients'),
    ('hard-to-follow-steps'),
    ('taste-not-right'),
    ('too-oily'),
    ('not-crispy'),
    ('pan-sticking-or-burning'),
    ('vegetables-too-soft'),
    ('soup-too-bland-or-salty'),
    ('ingredients-overcooked'),
    ('steamed-unevenly'),
    ('fishy-smell'),
    ('too-dry'),
    ('too-sweet'),
    ('texture-failed'),
    ('temperature-control-hard'),
    ('bland-flavor'),
    ('lacks-protein')
),
issue_counts AS (
  SELECT
    cf.user_id,
    issue_value.issue::text AS issue,
    COUNT(*)::integer AS issue_count
  FROM cooking_feedback cf
  CROSS JOIN LATERAL UNNEST(cf.issues) AS issue_value(issue)
  GROUP BY cf.user_id, issue_value.issue::text
),
issue_rollup AS (
  SELECT
    fs.user_id,
    JSONB_OBJECT_AGG(ik.issue, COALESCE(ic.issue_count, 0) ORDER BY ik.issue) AS issue_counts,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue IN (
        'cutting-meat-hard',
        'hard-to-follow-steps',
        'pan-sticking-or-burning',
        'steamed-unevenly',
        'texture-failed',
        'temperature-control-hard'
      )
    )::integer AS easy_issue_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue = 'took-longer-than-expected'
    )::integer AS quick_issue_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue IN ('missing-ingredients', 'lacks-protein')
    )::integer AS ingredient_fit_issue_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue IN (
        'oil-splatter',
        'too-oily',
        'not-crispy',
        'vegetables-too-soft',
        'soup-too-bland-or-salty',
        'ingredients-overcooked',
        'fishy-smell',
        'too-dry',
        'too-sweet',
        'taste-not-right',
        'bland-flavor'
      )
    )::integer AS technique_issue_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue = 'cutting-meat-hard'
    )::integer AS cutting_meat_hard_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue = 'oil-splatter'
    )::integer AS oil_splatter_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue = 'took-longer-than-expected'
    )::integer AS took_longer_than_expected_count,
    SUM(COALESCE(ic.issue_count, 0)) FILTER (
      WHERE ik.issue = 'missing-ingredients'
    )::integer AS missing_ingredients_count
  FROM feedback_summary fs
  CROSS JOIN issue_keys ik
  LEFT JOIN issue_counts ic ON ic.user_id = fs.user_id AND ic.issue = ik.issue
  GROUP BY fs.user_id
),
rebuilt_insights AS (
  SELECT
    fs.user_id,
    fs.feedback_count,
    fs.average_rating,
    ROUND(LEAST(1, fs.feedback_count::numeric / 5), 3) AS confidence,
    CASE
      WHEN ir.easy_issue_count > 0
        THEN ROUND(LEAST(0.08, (ir.easy_issue_count::numeric / fs.feedback_count) * 0.08), 3)
      ELSE 0
    END AS easy_recipe_boost,
    CASE
      WHEN ir.quick_issue_count > 0
        THEN ROUND(LEAST(0.08, (ir.quick_issue_count::numeric / fs.feedback_count) * 0.08), 3)
      ELSE 0
    END AS quick_recipe_boost,
    CASE
      WHEN ir.ingredient_fit_issue_count > 0
        THEN ROUND(LEAST(0.08, (ir.ingredient_fit_issue_count::numeric / fs.feedback_count) * 0.08), 3)
      ELSE 0
    END AS ingredient_match_boost,
    CASE
      WHEN ir.technique_issue_count > 0
        THEN ROUND(LEAST(0.08, (ir.technique_issue_count::numeric / fs.feedback_count) * 0.08), 3)
      ELSE 0
    END AS technique_guidance_boost,
    ir.cutting_meat_hard_count,
    ir.oil_splatter_count,
    ir.took_longer_than_expected_count,
    ir.missing_ingredients_count,
    ir.issue_counts
  FROM feedback_summary fs
  JOIN issue_rollup ir ON ir.user_id = fs.user_id
)
INSERT INTO user_personalization_insights (
  user_id,
  feedback_count,
  average_rating,
  confidence,
  easy_recipe_boost,
  quick_recipe_boost,
  ingredient_match_boost,
  technique_guidance_boost,
  cutting_meat_hard_count,
  oil_splatter_count,
  took_longer_than_expected_count,
  missing_ingredients_count,
  issue_counts,
  updated_at
)
SELECT
  user_id,
  feedback_count,
  average_rating,
  confidence,
  easy_recipe_boost,
  quick_recipe_boost,
  ingredient_match_boost,
  technique_guidance_boost,
  cutting_meat_hard_count,
  oil_splatter_count,
  took_longer_than_expected_count,
  missing_ingredients_count,
  issue_counts,
  NOW()
FROM rebuilt_insights
ON CONFLICT (user_id) DO UPDATE SET
  feedback_count = EXCLUDED.feedback_count,
  average_rating = EXCLUDED.average_rating,
  confidence = EXCLUDED.confidence,
  easy_recipe_boost = EXCLUDED.easy_recipe_boost,
  quick_recipe_boost = EXCLUDED.quick_recipe_boost,
  ingredient_match_boost = EXCLUDED.ingredient_match_boost,
  technique_guidance_boost = EXCLUDED.technique_guidance_boost,
  cutting_meat_hard_count = EXCLUDED.cutting_meat_hard_count,
  oil_splatter_count = EXCLUDED.oil_splatter_count,
  took_longer_than_expected_count = EXCLUDED.took_longer_than_expected_count,
  missing_ingredients_count = EXCLUDED.missing_ingredients_count,
  issue_counts = EXCLUDED.issue_counts,
  updated_at = NOW();
