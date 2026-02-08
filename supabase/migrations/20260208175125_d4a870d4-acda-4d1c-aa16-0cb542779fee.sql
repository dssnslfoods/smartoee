
-- Cascade adjacent event times when editing production events
-- When end_ts changes → update next event's start_ts
-- When start_ts changes → update previous event's end_ts
CREATE OR REPLACE FUNCTION public.cascade_adjacent_event_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent recursive trigger calls (depth 1 = direct, >1 = cascaded)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- If end_ts changed, update the immediately next event's start_ts on same machine & shift
  IF OLD.end_ts IS DISTINCT FROM NEW.end_ts AND NEW.end_ts IS NOT NULL THEN
    UPDATE production_events
    SET start_ts = NEW.end_ts
    WHERE id = (
      SELECT pe.id
      FROM production_events pe
      WHERE pe.machine_id = NEW.machine_id
        AND pe.shift_calendar_id = NEW.shift_calendar_id
        AND pe.id != NEW.id
        AND pe.start_ts = OLD.end_ts
      LIMIT 1
    );
  END IF;

  -- If start_ts changed, update the immediately previous event's end_ts on same machine & shift
  IF OLD.start_ts IS DISTINCT FROM NEW.start_ts THEN
    UPDATE production_events
    SET end_ts = NEW.start_ts
    WHERE id = (
      SELECT pe.id
      FROM production_events pe
      WHERE pe.machine_id = NEW.machine_id
        AND pe.shift_calendar_id = NEW.shift_calendar_id
        AND pe.id != NEW.id
        AND pe.end_ts = OLD.start_ts
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (AFTER UPDATE so the current row is already saved)
CREATE TRIGGER trg_cascade_adjacent_event_times
  AFTER UPDATE OF start_ts, end_ts ON public.production_events
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_adjacent_event_times();
