-- Create borrower_positions table
CREATE TABLE IF NOT EXISTS borrower_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Borrower Info
    borrower_address TEXT NOT NULL,
    borrowed_amount DECIMAL(20, 6) NOT NULL,
    last_update_time BIGINT NOT NULL,
    total_collateral_value DECIMAL(20, 6) NOT NULL,
    loan_health DECIMAL(5, 2),
    status TEXT DEFAULT 'active',
    
    -- Constraints
    CONSTRAINT unique_borrower_address UNIQUE (borrower_address),
    CONSTRAINT valid_status CHECK (status IN ('active', 'repaid', 'defaulted'))
);

-- Create locked_nfts table
CREATE TABLE IF NOT EXISTS locked_nfts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- NFT Info
    collection_address TEXT NOT NULL,
    token_id BIGINT NOT NULL,
    
    -- Relationship
    borrower_position_id UUID NOT NULL REFERENCES borrower_positions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES real_estate_projects(id),
    
    -- Status
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlocked_at TIMESTAMPTZ,
    status TEXT DEFAULT 'locked',
    
    -- Constraints
    CONSTRAINT unique_nft UNIQUE (collection_address, token_id),
    CONSTRAINT valid_nft_status CHECK (status IN ('locked', 'unlocked', 'defaulted'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_borrower_positions_borrower_address ON borrower_positions(borrower_address);
CREATE INDEX IF NOT EXISTS idx_locked_nfts_collection_token ON locked_nfts(collection_address, token_id);
CREATE INDEX IF NOT EXISTS idx_locked_nfts_borrower_position ON locked_nfts(borrower_position_id);
CREATE INDEX IF NOT EXISTS idx_locked_nfts_project ON locked_nfts(project_id);

-- Create updated_at trigger for borrower_positions
CREATE TRIGGER update_borrower_positions_updated_at
BEFORE UPDATE ON borrower_positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for locked_nfts
CREATE TRIGGER update_locked_nfts_updated_at
BEFORE UPDATE ON locked_nfts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to get project details for locked NFTs
CREATE OR REPLACE FUNCTION get_locked_nfts_with_project_details(borrower TEXT)
RETURNS TABLE (
    id UUID,
    collection_address TEXT,
    token_id BIGINT,
    project_title TEXT,
    project_image TEXT,
    nft_value DECIMAL(20, 6),
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ln.id,
        ln.collection_address,
        ln.token_id,
        p.title AS project_title,
        p.nft_image AS project_image,
        p.price_per_nft AS nft_value,
        ln.status
    FROM 
        locked_nfts ln
    JOIN 
        borrower_positions bp ON ln.borrower_position_id = bp.id
    LEFT JOIN 
        projects p ON ln.project_id = p.id
    WHERE 
        bp.borrower_address = borrower
    ORDER BY 
        ln.created_at DESC;
END;
$$ LANGUAGE plpgsql;
