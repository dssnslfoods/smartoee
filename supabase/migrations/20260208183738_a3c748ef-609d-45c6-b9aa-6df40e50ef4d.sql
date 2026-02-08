
CREATE OR REPLACE FUNCTION public.rpc_update_event(
  p_event_id UUID,
  p_event_type event_type,
  p_start_ts TIMESTAMPTZ,
  p_end_ts TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_old RECORD;
  v_cascaded_next BOOLEAN := false;
  v_cascaded_prev BOOLEAN := false;
  v_delta INTERVAL;
  v_overlap_count INTEGER;
  v_affected_count INTEGER;
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

  -- STEP 1: Cascade to ALL subsequent events (shift by delta, preserving duration)
  -- When end_ts changes → calculate delta and shift all events after this one
  IF v_old.end_ts IS NOT NULL AND p_end_ts IS NOT NULL AND v_old.end_ts IS DISTINCT FROM p_end_ts THEN
    v_delta := p_end_ts - v_old.end_ts;

    UPDATE production_events
    SET start_ts = start_ts + v_delta,
        end_ts = CASE WHEN end_ts IS NOT NULL THEN end_ts + v_delta ELSE NULL END,
        updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND start_ts >= v_old.end_ts;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_next := true; END IF;

  ELSIF v_old.end_ts IS NULL AND p_end_ts IS NOT NULL THEN
    -- Event was open-ended, now getting an end time — shift subsequent events if any
    UPDATE production_events
    SET start_ts = p_end_ts,
        updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND start_ts = v_old.start_ts;  -- edge case: concurrent start

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_next := true; END IF;
  END IF;

  -- STEP 2: When start_ts changes → adjust previous event's end_ts to maintain continuity
  IF v_old.start_ts IS DISTINCT FROM p_start_ts THEN
    UPDATE production_events
    SET end_ts = p_start_ts,
        updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND end_ts = v_old.start_ts;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_prev := true; END IF;
  END IF;

  -- STEP 3: Update the target event itself
  UPDATE production_events
  SET event_type = p_event_type,
      start_ts = p_start_ts,
      end_ts = p_end_ts,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_event_id;

  -- STEP 4: Final overlap validation after all updates
  SELECT COUNT(*) INTO v_overlap_count
  FROM production_events a
  JOIN production_events b
    ON a.id < b.id
    AND a.machine_id = b.machine_id
    AND a.shift_calendar_id = b.shift_calendar_id
  WHERE a.machine_id = v_old.machine_id
    AND a.shift_calendar_id = v_old.shift_calendar_id
    AND a.end_ts IS NOT NULL
    AND b.end_ts IS NOT NULL
    AND a.start_ts < b.end_ts
    AND b.start_ts < a.end_ts;

  -- Also check overlap with open-ended events (max 1 open-ended allowed)
  IF v_overlap_count = 0 THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM production_events a
    JOIN production_events b
      ON a.id != b.id
      AND a.machine_id = b.machine_id
      AND a.shift_calendar_id = b.shift_calendar_id
    WHERE a.machine_id = v_old.machine_id
      AND a.shift_calendar_id = v_old.shift_calendar_id
      AND a.end_ts IS NULL
      AND b.end_ts IS NULL;
  END IF;

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
