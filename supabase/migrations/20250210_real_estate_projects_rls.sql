-- Enable RLS on real_estate_projects table
ALTER TABLE public.real_estate_projects ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
ON public.real_estate_projects FOR SELECT
USING (true);

-- Allow admin update access
CREATE POLICY "Allow admin update access"
ON public.real_estate_projects FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow admin insert access
CREATE POLICY "Allow admin insert access"
ON public.real_estate_projects FOR INSERT
WITH CHECK (true);

-- Allow admin delete access
CREATE POLICY "Allow admin delete access"
ON public.real_estate_projects FOR DELETE
USING (true);
