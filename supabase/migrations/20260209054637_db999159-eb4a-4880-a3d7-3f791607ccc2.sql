
-- Update rpc_update_event: validate that new times fall within active shift windows
CREATE OR REPLACE FUNCTION public.rpc_update_event(
  p_event_id uuid,
  p_event_type public.event_type,
  p_start_ts timestamptz,
  p_end_ts timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
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
  v_start_local_time TIME;
  v_end_local_time TIME;
  v_start_local_date DATE;
  v_end_local_date DATE;
  v_sc_check UUID;
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

  -- === NEW: Validate start_ts is within an active shift window ===
  v_start_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;
  v_start_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;

  -- Check today's shifts for start_ts
  SELECT sc.id INTO v_sc_check
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = v_old.plant_id
     AND s.is_active = true
     AND sc.shift_date = v_start_local_date
     AND (
       (s.start_time <= s.end_time AND v_start_local_time >= s.start_time AND v_start_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (v_start_local_time >= s.start_time OR v_start_local_time < s.end_time))
     )
   LIMIT 1;

  -- Check previous day overnight shifts for start_ts
  IF v_sc_check IS NULL THEN
    SELECT sc.id INTO v_sc_check
      FROM shift_calendar sc
      JOIN shifts s ON s.id = sc.shift_id
     WHERE sc.plant_id = v_old.plant_id
       AND s.is_active = true
       AND sc.shift_date = (v_start_local_date - interval '1 day')::date
       AND s.start_time > s.end_time
       AND v_start_local_time < s.end_time
     LIMIT 1;
  END IF;

  IF v_sc_check IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้');
  END IF;

  -- === Validate end_ts is within an active shift window (if provided) ===
  IF p_end_ts IS NOT NULL THEN
    v_end_local_time := (p_end_ts AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_end_local_date := (p_end_ts AT TIME ZONE 'Asia/Bangkok')::DATE;

    v_sc_check := NULL;

    SELECT sc.id INTO v_sc_check
      FROM shift_calendar sc
      JOIN shifts s ON s.id = sc.shift_id
     WHERE sc.plant_id = v_old.plant_id
       AND s.is_active = true
       AND sc.shift_date = v_end_local_date
       AND (
         (s.start_time <= s.end_time AND v_end_local_time >= s.start_time AND v_end_local_time <= s.end_time)
         OR
         (s.start_time > s.end_time AND (v_end_local_time >= s.start_time OR v_end_local_time <= s.end_time))
       )
     LIMIT 1;

    IF v_sc_check IS NULL THEN
      SELECT sc.id INTO v_sc_check
        FROM shift_calendar sc
        JOIN shifts s ON s.id = sc.shift_id
       WHERE sc.plant_id = v_old.plant_id
         AND s.is_active = true
         AND sc.shift_date = (v_end_local_date - interval '1 day')::date
         AND s.start_time > s.end_time
         AND v_end_local_time <= s.end_time
       LIMIT 1;
    END IF;

    IF v_sc_check IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาสิ้นสุดนอกช่วงกะได้');
    END IF;
  END IF;

  -- Bypass overlap and cascade triggers — we handle both manually
  PERFORM set_config('app.skip_overlap_check', 'true', true);
  PERFORM set_config('app.skip_cascade', 'true', true);

  -- STEP 1: Cascade to ALL subsequent events
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
    UPDATE production_events
    SET start_ts = p_end_ts,
        updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND start_ts = v_old.start_ts;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_next := true; END IF;
  END IF;

  -- STEP 2: When start_ts changes → adjust previous event's end_ts
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

  -- STEP 4: Final overlap validation
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
    RAISE EXCEPTION 'OVERLAP_AFTER_CASCADE';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'cascaded_next', v_cascaded_next,
    'cascaded_prev', v_cascaded_prev,
    'message', 'Event updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%OVERLAP%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', 'เหตุการณ์ซ้อนทับกับเหตุการณ์อื่น กรุณาตรวจสอบเวลาอีกครั้ง');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN', 'message', SQLERRM);
END;
$$;


-- Update rpc_create_manual_event: strict shift time validation (no fallback)
DROP FUNCTION IF EXISTS public.rpc_create_manual_event(uuid, public.event_type, timestamptz, timestamptz, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.rpc_create_manual_event(
  p_machine_id uuid,
  p_event_type public.event_type,
  p_start_ts timestamptz,
  p_end_ts timestamptz DEFAULT NULL,
  p_reason_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_shift_calendar_id UUID;
  v_machine RECORD;
  v_event_id UUID;
  v_is_locked BOOLEAN;
  v_local_date DATE;
  v_local_time TIME;
  v_end_local_time TIME;
  v_end_local_date DATE;
  v_sc_check UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
  END IF;

  -- Check machine permission
  IF NOT public.has_machine_permission(v_user_id, p_machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  -- Validate times
  IF p_end_ts IS NOT NULL AND p_end_ts <= p_start_ts THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'End time must be after start time');
  END IF;

  -- Get machine info
  SELECT m.*, l.plant_id INTO v_machine
  FROM public.machines m
  JOIN public.lines l ON m.line_id = l.id
  WHERE m.id = p_machine_id AND m.is_active = true;

  IF v_machine IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
  END IF;

  -- Validate start_ts within active shift window
  v_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;

  -- Normal shifts for start_ts
  SELECT sc.id INTO v_shift_calendar_id
  FROM public.shift_calendar sc
  JOIN public.shifts s ON sc.shift_id = s.id
  WHERE sc.plant_id = v_machine.plant_id
    AND s.is_active = true
    AND sc.shift_date = v_local_date
    AND (
      (s.start_time <= s.end_time AND v_local_time >= s.start_time AND v_local_time < s.end_time)
      OR
      (s.start_time > s.end_time AND (v_local_time >= s.start_time OR v_local_time < s.end_time))
    )
  LIMIT 1;

  -- Check previous day overnight shifts for start_ts
  IF v_shift_calendar_id IS NULL THEN
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND s.is_active = true
      AND sc.shift_date = (v_local_date - interval '1 day')::date
      AND s.start_time > s.end_time
      AND v_local_time < s.end_time
    LIMIT 1;
  END IF;

  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้');
  END IF;

  -- Validate end_ts within active shift window (if provided)
  IF p_end_ts IS NOT NULL THEN
    v_end_local_time := (p_end_ts AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_end_local_date := (p_end_ts AT TIME ZONE 'Asia/Bangkok')::DATE;

    v_sc_check := NULL;

    SELECT sc.id INTO v_sc_check
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND s.is_active = true
      AND sc.shift_date = v_end_local_date
      AND (
        (s.start_time <= s.end_time AND v_end_local_time >= s.start_time AND v_end_local_time <= s.end_time)
        OR
        (s.start_time > s.end_time AND (v_end_local_time >= s.start_time OR v_end_local_time <= s.end_time))
      )
    LIMIT 1;

    IF v_sc_check IS NULL THEN
      SELECT sc.id INTO v_sc_check
      FROM public.shift_calendar sc
      JOIN public.shifts s ON sc.shift_id = s.id
      WHERE sc.plant_id = v_machine.plant_id
        AND s.is_active = true
        AND sc.shift_date = (v_end_local_date - interval '1 day')::date
        AND s.start_time > s.end_time
        AND v_end_local_time <= s.end_time
      LIMIT 1;
    END IF;

    IF v_sc_check IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาสิ้นสุดนอกช่วงกะได้');
    END IF;
  END IF;

  -- Check if shift is locked
  v_is_locked := public.is_shift_locked(v_shift_calendar_id);
  IF v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถเพิ่มเหตุการณ์ได้');
  END IF;

  -- Validate reason for DOWNTIME/SETUP
  IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
  END IF;

  -- Insert the event (overlap trigger will validate)
  INSERT INTO public.production_events (
    plant_id, line_id, machine_id, shift_calendar_id,
    event_type, reason_id, product_id, start_ts, end_ts, notes, created_by
  ) VALUES (
    v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
    p_event_type, p_reason_id, p_product_id, p_start_ts, p_end_ts, p_notes, v_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'message', 'Manual event created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', 'เหตุการณ์ซ้อนทับกับเหตุการณ์อื่นในช่วงเวลานี้');
    ELSIF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถเพิ่มเหตุการณ์ได้');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN', 'message', SQLERRM);
END;
$$;
