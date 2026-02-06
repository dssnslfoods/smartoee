
-- Add target OEE columns to machines table
ALTER TABLE public.machines
ADD COLUMN target_oee numeric(5,2) DEFAULT 85.00,
ADD COLUMN target_availability numeric(5,2) DEFAULT 90.00,
ADD COLUMN target_performance numeric(5,2) DEFAULT 95.00,
ADD COLUMN target_quality numeric(5,2) DEFAULT 99.00;

-- Add comments for documentation
COMMENT ON COLUMN public.machines.target_oee IS 'Target OEE percentage (0-100)';
COMMENT ON COLUMN public.machines.target_availability IS 'Target Availability percentage (0-100)';
COMMENT ON COLUMN public.machines.target_performance IS 'Target Performance percentage (0-100)';
COMMENT ON COLUMN public.machines.target_quality IS 'Target Quality percentage (0-100)';
