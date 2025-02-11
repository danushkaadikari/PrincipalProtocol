-- Modify features column to use JSONB
ALTER TABLE real_estate_projects 
  ALTER COLUMN features DROP DEFAULT,
  ALTER COLUMN features TYPE JSONB USING CASE 
    WHEN features IS NULL THEN '[]'::jsonb
    WHEN features = '{}' THEN '[]'::jsonb
    ELSE array_to_json(features)::jsonb
  END,
  ALTER COLUMN features SET DEFAULT '[]'::jsonb;
