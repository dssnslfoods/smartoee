
-- Preserve historical production data: change CASCADE to SET NULL
-- so events and counts remain even after shift/shift_calendar is deleted

-- 1. production_events: SET NULL instead of CASCADE
ALTER TABLE public.production_events
  DROP CONSTRAINT production_events_shift_calendar_id_fkey,
  ADD CONSTRAINT production_events_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE SET NULL;

-- Allow shift_calendar_id to be nullable on production_events
ALTER TABLE public.production_events
  ALTER COLUMN shift_calendar_id DROP NOT NULL;

-- 2. production_counts: SET NULL instead of CASCADE
ALTER TABLE public.production_counts
  DROP CONSTRAINT production_counts_shift_calendar_id_fkey,
  ADD CONSTRAINT production_counts_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE SET NULL;

-- Allow shift_calendar_id to be nullable on production_counts
ALTER TABLE public.production_counts
  ALTER COLUMN shift_calendar_id DROP NOT NULL;
