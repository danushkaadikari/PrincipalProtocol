-- Change token_id column in locked_nfts from BIGINT to TEXT to handle extremely large token IDs
ALTER TABLE locked_nfts 
  ALTER COLUMN token_id TYPE TEXT;

-- Update the function that returns locked NFTs with project details
CREATE OR REPLACE FUNCTION get_locked_nfts_with_project_details(borrower TEXT)
RETURNS TABLE (
    id UUID,
    collection_address TEXT,
    token_id TEXT,
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
