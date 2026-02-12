-- Drop the partial unique index that can't be used with ON CONFLICT
DROP INDEX IF EXISTS public.oee_snapshots_unique_machine_shift;

-- Create a proper unique constraint that ON CONFLICT can reference
CREATE UNIQUE INDEX oee_snapshots_unique_machine_shift 
ON public.oee_snapshots (scope, scope_id, period, shift_calendar_id) 
WHERE (shift_calendar_id IS NOT NULL);