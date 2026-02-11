
-- Allow deleting inactive shifts by cascading delete to shift_calendar
-- and setting oee_snapshots.shift_calendar_id to NULL (preserve historical data)

-- 1. oee_snapshots: change FK to SET NULL so snapshots are preserved
ALTER TABLE public.oee_snapshots
  DROP CONSTRAINT oee_snapshots_shift_calendar_id_fkey,
  ADD CONSTRAINT oee_snapshots_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE SET NULL;

-- 2. shift_approvals: cascade delete when shift_calendar is deleted
ALTER TABLE public.shift_approvals
  DROP CONSTRAINT shift_approvals_shift_calendar_id_fkey,
  ADD CONSTRAINT shift_approvals_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE CASCADE;

-- 3. production_events: cascade delete when shift_calendar is deleted
ALTER TABLE public.production_events
  DROP CONSTRAINT production_events_shift_calendar_id_fkey,
  ADD CONSTRAINT production_events_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE CASCADE;

-- 4. production_counts: cascade delete when shift_calendar is deleted
ALTER TABLE public.production_counts
  DROP CONSTRAINT production_counts_shift_calendar_id_fkey,
  ADD CONSTRAINT production_counts_shift_calendar_id_fkey
    FOREIGN KEY (shift_calendar_id) REFERENCES public.shift_calendar(id)
    ON DELETE CASCADE;

-- 5. shift_calendar: cascade delete when shift is deleted
ALTER TABLE public.shift_calendar
  DROP CONSTRAINT shift_calendar_shift_id_fkey,
  ADD CONSTRAINT shift_calendar_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES public.shifts(id)
    ON DELETE CASCADE;
