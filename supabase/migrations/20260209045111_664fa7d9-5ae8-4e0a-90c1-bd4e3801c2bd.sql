-- Add effective_from column to shifts table
ALTER TABLE public.shifts
ADD COLUMN effective_from DATE NOT NULL DEFAULT CURRENT_DATE;

-- Add effective_from column to planned_time_templates table
ALTER TABLE public.planned_time_templates
ADD COLUMN effective_from DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update existing shifts to use their created_at date as effective_from
UPDATE public.shifts SET effective_from = created_at::DATE;

-- Update existing planned_time_templates to use their created_at date as effective_from
UPDATE public.planned_time_templates SET effective_from = created_at::DATE;