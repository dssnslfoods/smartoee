
-- 1. Update check_event_overlap to support GUC bypass (for rpc_update_event)
CREATE OR REPLACE FUNCTION public.check_event_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    -- Allow bypass when called from rpc_update_event (which handles overlap manually)
    IF current_setting('app.skip_overlap_check', true) = 'true' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO overlap_count
    FROM public.production_events pe
    WHERE pe.machine_id = NEW.machine_id
      AND pe.shift_calendar_id = NEW.shift_calendar_id
      AND pe.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
          (NEW.start_ts >= pe.start_ts AND NEW.start_ts < COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          (COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) > pe.start_ts 
           AND COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) <= COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          (NEW.start_ts <= pe.start_ts 
           AND COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) >= COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          (NEW.end_ts IS NULL AND pe.end_ts IS NULL)
      );

    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'OVERLAP_EVENT: Cannot create overlapping events on the same machine within the same shift'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Update cascade trigger to support GUC bypass
CREATE OR REPLACE FUNCTION public.cascade_adjacent_event_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow bypass when rpc_update_event handles cascade manually
  IF current_setting('app.skip_cascade', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

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

-- 3. Create rpc_update_event — handles cascade + overlap in correct order
CREATE OR REPLACE FUNCTION public.rpc_update_event(
  p_event_id UUID,
  p_event_type event_type,
  p_start_ts TIMESTAMPTZ,
  p_end_ts TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_old RECORD;
  v_cascaded_next BOOLEAN := false;
  v_cascaded_prev BOOLEAN := false;
  v_overlap_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
  END IF;

  -- Get existing event
  SELECT * INTO v_old FROM production_events WHERE id = p_event_id;
  IF v_old IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Event not found');
  END IF;

  -- Permission check
  IF NOT has_machine_permission(v_user_id, v_old.machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  -- Shift lock check
  IF is_shift_locked(v_old.shift_calendar_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
  END IF;

  -- Bypass overlap and cascade triggers — we handle both manually
  PERFORM set_config('app.skip_overlap_check', 'true', true);
  PERFORM set_config('app.skip_cascade', 'true', true);

  -- STEP 1: Cascade to adjacent events BEFORE updating target
  -- If end_ts changed → update next event's start_ts
  IF v_old.end_ts IS DISTINCT FROM p_end_ts AND p_end_ts IS NOT NULL AND v_old.end_ts IS NOT NULL THEN
    UPDATE production_events
    SET start_ts = p_end_ts
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND start_ts = v_old.end_ts;
    IF FOUND THEN v_cascaded_next := true; END IF;
  END IF;

  -- If start_ts changed → update previous event's end_ts
  IF v_old.start_ts IS DISTINCT FROM p_start_ts THEN
    UPDATE production_events
    SET end_ts = p_start_ts
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND end_ts = v_old.start_ts;
    IF FOUND THEN v_cascaded_prev := true; END IF;
  END IF;

  -- STEP 2: Update the target event
  UPDATE production_events
  SET event_type = p_event_type,
      start_ts = p_start_ts,
      end_ts = p_end_ts,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_event_id;

  -- STEP 3: Manual overlap validation after all updates
  SELECT COUNT(*) INTO v_overlap_count
  FROM production_events a
  JOIN production_events b
    ON a.id < b.id
    AND a.machine_id = b.machine_id
    AND a.shift_calendar_id = b.shift_calendar_id
  WHERE a.machine_id = v_old.machine_id
    AND a.shift_calendar_id = v_old.shift_calendar_id
    AND a.start_ts < COALESCE(b.end_ts, 'infinity'::TIMESTAMPTZ)
    AND b.start_ts < COALESCE(a.end_ts, 'infinity'::TIMESTAMPTZ);

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'OVERLAP_EVENT: การเปลี่ยนเวลาทำให้เกิดเหตุการณ์ซ้อนทับกัน';
  END IF;

  -- Reset GUC flags
  PERFORM set_config('app.skip_overlap_check', 'false', true);
  PERFORM set_config('app.skip_cascade', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'อัปเดตเหตุการณ์สำเร็จ',
    'cascaded_next', v_cascaded_next,
    'cascaded_prev', v_cascaded_prev
  );

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', SQLERRM);
    ELSIF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
    END IF;
END;
$$;
