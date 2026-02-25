-- Add break time window columns to planned_time_templates
-- These define when the auto-break-stop should trigger
ALTER TABLE public.planned_time_templates 
  ADD COLUMN break_start_time time without time zone DEFAULT NULL,
  ADD COLUMN break_end_time time without time zone DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.planned_time_templates.break_start_time IS 'Start time of scheduled break for auto-stop (e.g. 12:00)';
COMMENT ON COLUMN public.planned_time_templates.break_end_time IS 'End time of scheduled break for auto-stop (e.g. 13:00)';
