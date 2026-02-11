
-- Cascade delete PPT templates when shift is deleted
ALTER TABLE public.planned_time_templates
  DROP CONSTRAINT planned_time_templates_shift_id_fkey,
  ADD CONSTRAINT planned_time_templates_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES public.shifts(id)
    ON DELETE CASCADE;
