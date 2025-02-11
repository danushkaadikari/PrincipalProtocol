-- Update property_images column to be JSONB
ALTER TABLE real_estate_projects DROP COLUMN IF EXISTS property_images;
ALTER TABLE real_estate_projects ADD COLUMN property_images JSONB DEFAULT NULL;
