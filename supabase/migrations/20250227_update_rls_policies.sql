-- Create a function to get the wallet address from request headers
CREATE OR REPLACE FUNCTION public.get_wallet_address()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-wallet-address',
    NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update borrower_positions table policies
DROP POLICY IF EXISTS "Users can view their own borrower positions" ON "public"."borrower_positions";
CREATE POLICY "Users can view their own borrower positions" 
ON "public"."borrower_positions"
FOR SELECT
USING (
  (borrower_address = get_wallet_address()) OR 
  (auth.uid() IS NOT NULL AND borrower_address = (auth.jwt()->>'wallet_address'))
);

DROP POLICY IF EXISTS "Users can insert their own borrower positions" ON "public"."borrower_positions";
CREATE POLICY "Users can insert their own borrower positions" 
ON "public"."borrower_positions"
FOR INSERT
WITH CHECK (
  (borrower_address = get_wallet_address()) OR 
  (auth.uid() IS NOT NULL AND borrower_address = (auth.jwt()->>'wallet_address'))
);

DROP POLICY IF EXISTS "Users can update their own borrower positions" ON "public"."borrower_positions";
CREATE POLICY "Users can update their own borrower positions" 
ON "public"."borrower_positions"
FOR UPDATE
USING (
  (borrower_address = get_wallet_address()) OR 
  (auth.uid() IS NOT NULL AND borrower_address = (auth.jwt()->>'wallet_address'))
);

-- Update locked_nfts table policies
DROP POLICY IF EXISTS "Users can view their own locked NFTs" ON "public"."locked_nfts";
CREATE POLICY "Users can view their own locked NFTs" 
ON "public"."locked_nfts"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM borrower_positions bp 
    WHERE bp.id = locked_nfts.borrower_position_id 
    AND (
      bp.borrower_address = get_wallet_address() OR
      (auth.uid() IS NOT NULL AND bp.borrower_address = (auth.jwt()->>'wallet_address'))
    )
  )
);

DROP POLICY IF EXISTS "Users can insert their own locked NFTs" ON "public"."locked_nfts";
CREATE POLICY "Users can insert their own locked NFTs" 
ON "public"."locked_nfts"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM borrower_positions bp 
    WHERE bp.id = locked_nfts.borrower_position_id 
    AND (
      bp.borrower_address = get_wallet_address() OR
      (auth.uid() IS NOT NULL AND bp.borrower_address = (auth.jwt()->>'wallet_address'))
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own locked NFTs" ON "public"."locked_nfts";
CREATE POLICY "Users can update their own locked NFTs" 
ON "public"."locked_nfts"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM borrower_positions bp 
    WHERE bp.id = locked_nfts.borrower_position_id 
    AND (
      bp.borrower_address = get_wallet_address() OR
      (auth.uid() IS NOT NULL AND bp.borrower_address = (auth.jwt()->>'wallet_address'))
    )
  )
);

-- Update borrowing_details table policies
DROP POLICY IF EXISTS "Users can view their own borrowing details" ON "public"."borrowing_details";
CREATE POLICY "Users can view their own borrowing details" 
ON "public"."borrowing_details"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM borrower_positions bp 
    WHERE bp.id = borrowing_details.borrower_position_id 
    AND (
      bp.borrower_address = get_wallet_address() OR
      (auth.uid() IS NOT NULL AND bp.borrower_address = (auth.jwt()->>'wallet_address'))
    )
  )
);

DROP POLICY IF EXISTS "Users can insert their own borrowing details" ON "public"."borrowing_details";
CREATE POLICY "Users can insert their own borrowing details" 
ON "public"."borrowing_details"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM borrower_positions bp 
    WHERE bp.id = borrowing_details.borrower_position_id 
    AND (
      bp.borrower_address = get_wallet_address() OR
      (auth.uid() IS NOT NULL AND bp.borrower_address = (auth.jwt()->>'wallet_address'))
    )
  )
);
