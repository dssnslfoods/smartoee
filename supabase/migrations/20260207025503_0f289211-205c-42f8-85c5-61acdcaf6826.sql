-- Add time_unit column to machines table
-- Stores the preferred time unit for displaying cycle times per machine
-- Internally, all values are always stored in seconds
ALTER TABLE public.machines
ADD COLUMN time_unit text NOT NULL DEFAULT 'seconds'
CONSTRAINT machines_time_unit_check CHECK (time_unit IN ('seconds', 'minutes'));