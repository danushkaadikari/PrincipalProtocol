-- Drop existing features column and recreate as TEXT
ALTER TABLE real_estate_projects DROP COLUMN features;
ALTER TABLE real_estate_projects ADD COLUMN features TEXT;
