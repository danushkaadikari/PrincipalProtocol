-- Add new columns to real_estate_projects table
ALTER TABLE real_estate_projects
ADD COLUMN property_type text,
ADD COLUMN bedrooms integer,
ADD COLUMN bathrooms integer,
ADD COLUMN area text,
ADD COLUMN year_built integer,
ADD COLUMN features text[],
ADD COLUMN documents jsonb DEFAULT '[]'::jsonb,
ADD COLUMN expected_yield text,
ADD COLUMN rental_income text,
ADD COLUMN property_management_fee text,
ADD COLUMN insurance_cost text;
