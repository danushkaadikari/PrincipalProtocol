-- Create borrowing_details table to track borrowing transactions
CREATE TABLE IF NOT EXISTS borrowing_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Transaction Info
    transaction_hash TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    
    -- Borrower Info
    borrower_address TEXT NOT NULL,
    
    -- Amount Info
    amount DECIMAL(20, 6) NOT NULL,
    
    -- Relationship
    borrower_position_id UUID REFERENCES borrower_positions(id) ON DELETE SET NULL,
    
    -- NFT Details for collateral operations
    collection_addresses TEXT[],
    token_ids BIGINT[],
    
    -- Status
    status TEXT DEFAULT 'completed',
    
    -- Constraints
    CONSTRAINT unique_transaction_hash UNIQUE (transaction_hash),
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('borrow', 'repay', 'lock', 'unlock')),
    CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_borrowing_details_borrower ON borrowing_details(borrower_address);
CREATE INDEX IF NOT EXISTS idx_borrowing_details_transaction_type ON borrowing_details(transaction_type);
CREATE INDEX IF NOT EXISTS idx_borrowing_details_borrower_position ON borrowing_details(borrower_position_id);

-- Create updated_at trigger for borrowing_details
CREATE TRIGGER update_borrowing_details_updated_at
BEFORE UPDATE ON borrowing_details
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to get borrowing history for a borrower
CREATE OR REPLACE FUNCTION get_borrower_transaction_history(borrower TEXT)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    transaction_hash TEXT,
    transaction_type TEXT,
    amount DECIMAL(20, 6),
    collection_addresses TEXT[],
    token_ids BIGINT[],
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bd.id,
        bd.created_at,
        bd.transaction_hash,
        bd.transaction_type,
        bd.amount,
        bd.collection_addresses,
        bd.token_ids,
        bd.status
    FROM 
        borrowing_details bd
    WHERE 
        bd.borrower_address = borrower
    ORDER BY 
        bd.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get summary of borrowing activity
CREATE OR REPLACE FUNCTION get_borrowing_activity_summary()
RETURNS TABLE (
    total_borrowed DECIMAL(20, 6),
    total_repaid DECIMAL(20, 6),
    active_loans BIGINT,
    total_locked_nfts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'borrow' THEN amount ELSE 0 END), 0) AS total_borrowed,
        COALESCE(SUM(CASE WHEN transaction_type = 'repay' THEN amount ELSE 0 END), 0) AS total_repaid,
        COUNT(DISTINCT borrower_position_id) FILTER (WHERE EXISTS (
            SELECT 1 FROM borrower_positions bp WHERE bp.id = borrowing_details.borrower_position_id AND bp.status = 'active'
        )) AS active_loans,
        (SELECT COUNT(*) FROM locked_nfts WHERE status = 'locked') AS total_locked_nfts
    FROM 
        borrowing_details;
END;
$$ LANGUAGE plpgsql;
