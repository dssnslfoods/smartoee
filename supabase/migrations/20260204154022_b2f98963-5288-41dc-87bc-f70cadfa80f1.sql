-- Add company_id to lines table
ALTER TABLE public.lines ADD COLUMN company_id uuid;

-- Backfill company_id from plants
UPDATE public.lines l
SET company_id = p.company_id
FROM public.plants p
WHERE l.plant_id = p.id;

-- Make company_id NOT NULL
ALTER TABLE public.lines ALTER COLUMN company_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.lines 
ADD CONSTRAINT lines_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id);

-- Add company_id to machines table
ALTER TABLE public.machines ADD COLUMN company_id uuid;

-- Backfill company_id from lines -> plants
UPDATE public.machines m
SET company_id = p.company_id
FROM public.lines l
JOIN public.plants p ON l.plant_id = p.id
WHERE m.line_id = l.id;

-- Make company_id NOT NULL
ALTER TABLE public.machines ALTER COLUMN company_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.machines 
ADD CONSTRAINT machines_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id);