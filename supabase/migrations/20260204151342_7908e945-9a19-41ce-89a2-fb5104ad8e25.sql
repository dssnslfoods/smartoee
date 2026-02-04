-- Add company_id to plants table
ALTER TABLE public.plants 
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create index for better query performance
CREATE INDEX idx_plants_company_id ON public.plants(company_id);

-- Update existing plants to link to the company
UPDATE public.plants 
SET company_id = 'e9fac91d-ef51-41e1-978a-842e8ba47323'
WHERE company_id IS NULL;