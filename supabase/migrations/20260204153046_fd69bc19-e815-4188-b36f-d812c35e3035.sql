-- Make company_id required for plants (not null)
-- First update any existing plants without a company to link to the first active company
UPDATE public.plants 
SET company_id = (SELECT id FROM public.companies WHERE is_active = true ORDER BY name LIMIT 1)
WHERE company_id IS NULL;

-- Now alter the column to be NOT NULL
ALTER TABLE public.plants 
ALTER COLUMN company_id SET NOT NULL;