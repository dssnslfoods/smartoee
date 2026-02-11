-- Add working_days column to shifts table
-- Stores array of day-of-week integers: 0=Sunday, 1=Monday, ..., 6=Saturday
-- Default to Monday-Saturday (1,2,3,4,5,6)
ALTER TABLE public.shifts 
ADD COLUMN working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6];