-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Basic Info
    title TEXT NOT NULL,
    description TEXT,
    total_supply INTEGER NOT NULL,
    price_per_nft DECIMAL(20, 6) NOT NULL,
    
    -- Images
    property_images TEXT[] DEFAULT '{}',
    nft_image TEXT,
    
    -- Property Details
    property_type TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area DECIMAL(10, 2),
    year_built INTEGER,
    features TEXT[] DEFAULT '{}',
    
    -- Documents
    documents JSONB[] DEFAULT '{}',
    
    -- Financial Details
    expected_yield DECIMAL(5, 2),
    rental_income DECIMAL(20, 2),
    property_management_fee DECIMAL(5, 2),
    insurance_cost DECIMAL(20, 2),
    
    -- Blockchain Details
    collection_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    
    -- Indexes
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'sold_out')),
    CONSTRAINT unique_collection_address UNIQUE (collection_address)
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read projects
CREATE POLICY "Allow authenticated users to read projects"
    ON projects FOR SELECT
    TO authenticated
    USING (true);

-- Allow only admin users to insert/update/delete projects
CREATE POLICY "Allow admin users to manage projects"
    ON projects FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');
