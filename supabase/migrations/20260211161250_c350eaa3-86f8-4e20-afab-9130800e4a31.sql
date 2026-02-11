
-- Helper function to check if a date falls on a shift's working day
CREATE OR REPLACE FUNCTION public.is_shift_working_day(_shift_id uuid, _check_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE id = _shift_id
      AND (EXTRACT(DOW FROM _check_date))::int = ANY(working_days)
  )
$$;

-- Update rpc_start_event to check working_days
CREATE OR REPLACE FUNCTION public.rpc_start_event(p_machine_id uuid, p_event_type event_type, p_reason_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_product_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_shift_calendar_id UUID;
  v_machine RECORD;
  v_event_id UUID;
  v_is_locked BOOLEAN;
  v_local_time TIME;
  v_local_date DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
  END IF;

  IF NOT public.has_machine_permission(v_user_id, p_machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  SELECT m.*, l.plant_id INTO v_machine
  FROM public.machines m
  JOIN public.lines l ON m.line_id = l.id
  WHERE m.id = p_machine_id AND m.is_active = true;

  IF v_machine IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
  END IF;

  v_local_time := (now() AT TIME ZONE 'Asia/Bangkok')::TIME;
  v_local_date := (now() AT TIME ZONE 'Asia/Bangkok')::DATE;

  -- Match active shifts where current time falls within window AND working_days match
  SELECT sc.id INTO v_shift_calendar_id
  FROM public.shift_calendar sc
  JOIN public.shifts s ON sc.shift_id = s.id
  WHERE sc.plant_id = v_machine.plant_id
    AND s.is_active = true
    AND sc.shift_date = v_local_date
    AND (EXTRACT(DOW FROM v_local_date))::int = ANY(s.working_days)
    AND (
      (s.start_time <= s.end_time AND v_local_time >= s.start_time AND v_local_time < s.end_time)
      OR
      (s.start_time > s.end_time AND (v_local_time >= s.start_time OR v_local_time < s.end_time))
    )
  LIMIT 1;

  -- Check previous day for overnight shifts
  IF v_shift_calendar_id IS NULL THEN
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND s.is_active = true
      AND sc.shift_date = (v_local_date - interval '1 day')::date
      AND (EXTRACT(DOW FROM (v_local_date - interval '1 day')::date))::int = ANY(s.working_days)
      AND s.start_time > s.end_time
      AND v_local_time < s.end_time
    LIMIT 1;
  END IF;

  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถรันเครื่องจักรได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  v_is_locked := public.is_shift_locked(v_shift_calendar_id);
  IF v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
  END IF;

  IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
  END IF;

  UPDATE public.production_events
  SET end_ts = now(), updated_at = now()
  WHERE machine_id = p_machine_id AND end_ts IS NULL;

  INSERT INTO public.production_events (
    plant_id, line_id, machine_id, shift_calendar_id,
    event_type, reason_id, product_id, start_ts, notes, created_by
  ) VALUES (
    v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
    p_event_type, p_reason_id, p_product_id, now(), p_notes, v_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'message', 'Event started successfully');

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', SQLERRM);
    ELSIF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', SQLERRM);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
    END IF;
END;
$function$;

-- Update rpc_add_counts to check working_days
CREATE OR REPLACE FUNCTION public.rpc_add_counts(p_machine_id uuid, p_good_qty integer, p_reject_qty integer DEFAULT 0, p_defect_reason_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_plant_id uuid;
  v_sc_id uuid;
  v_now timestamptz := now();
  v_local_time time;
  v_local_date date;
BEGIN
  SELECT l.plant_id INTO v_plant_id
    FROM machines m
    JOIN lines l ON l.id = m.line_id
   WHERE m.id = p_machine_id;

  IF v_plant_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Machine not found');
  END IF;

  v_local_time := (v_now AT TIME ZONE 'Asia/Bangkok')::time;
  v_local_date := (v_now AT TIME ZONE 'Asia/Bangkok')::date;

  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = v_plant_id
     AND s.is_active = true
     AND sc.shift_date = v_local_date
     AND (EXTRACT(DOW FROM v_local_date))::int = ANY(s.working_days)
     AND (
       (s.start_time <= s.end_time AND v_local_time >= s.start_time AND v_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (v_local_time >= s.start_time OR v_local_time < s.end_time))
     )
   LIMIT 1;

  IF v_sc_id IS NULL THEN
    SELECT sc.id INTO v_sc_id
      FROM shift_calendar sc
      JOIN shifts s ON s.id = sc.shift_id
     WHERE sc.plant_id = v_plant_id
       AND s.is_active = true
       AND sc.shift_date = ((v_now AT TIME ZONE 'Asia/Bangkok')::date - interval '1 day')::date
       AND (EXTRACT(DOW FROM ((v_now AT TIME ZONE 'Asia/Bangkok')::date - interval '1 day')::date))::int = ANY(s.working_days)
       AND s.start_time > s.end_time
       AND v_local_time < s.end_time
     LIMIT 1;
  END IF;

  IF v_sc_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'นอกเวลาทำการ ไม่สามารถบันทึกจำนวนผลิตได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  IF is_shift_locked(v_sc_id) THEN
    RETURN json_build_object('ok', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
  END IF;

  INSERT INTO production_counts (
    machine_id, shift_calendar_id,
    good_qty, reject_qty, defect_reason_id, notes,
    created_by
  ) VALUES (
    p_machine_id, v_sc_id,
    p_good_qty, p_reject_qty, p_defect_reason_id, p_notes,
    v_user_id
  );

  RETURN json_build_object('ok', true);
END;
$function$;

-- Update rpc_create_manual_event to check working_days
CREATE OR REPLACE FUNCTION public.rpc_create_manual_event(p_machine_id uuid, p_event_type event_type, p_start_ts timestamp with time zone, p_end_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
  END IF;

  IF NOT public.has_machine_permission(v_user_id, p_machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  IF p_end_ts IS NOT NULL AND p_end_ts <= p_start_ts THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'End time must be after start time');
  END IF;

  SELECT m.*, l.plant_id INTO v_machine
  FROM public.machines m
  JOIN public.lines l ON m.line_id = l.id
  WHERE m.id = p_machine_id AND m.is_active = true;

  IF v_machine IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
  END IF;

  -- Validate start_ts within active shift window + working_days
  v_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;

  SELECT sc.id INTO v_shift_calendar_id
  FROM public.shift_calendar sc
  JOIN public.shifts s ON sc.shift_id = s.id
  WHERE sc.plant_id = v_machine.plant_id
    AND s.is_active = true
    AND sc.shift_date = v_local_date
    AND (EXTRACT(DOW FROM v_local_date))::int = ANY(s.working_days)
    AND (
      (s.start_time <= s.end_time AND v_local_time >= s.start_time AND v_local_time < s.end_time)
      OR
      (s.start_time > s.end_time AND (v_local_time >= s.start_time OR v_local_time < s.end_time))
    )
  LIMIT 1;

  IF v_shift_calendar_id IS NULL THEN
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND s.is_active = true
      AND sc.shift_date = (v_local_date - interval '1 day')::date
      AND (EXTRACT(DOW FROM (v_local_date - interval '1 day')::date))::int = ANY(s.working_days)
      AND s.start_time > s.end_time
      AND v_local_time < s.end_time
    LIMIT 1;
  END IF;

  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  -- Validate end_ts
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
      AND (EXTRACT(DOW FROM v_end_local_date))::int = ANY(s.working_days)
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
        AND (EXTRACT(DOW FROM (v_end_local_date - interval '1 day')::date))::int = ANY(s.working_days)
        AND s.start_time > s.end_time
        AND v_end_local_time <= s.end_time
      LIMIT 1;
    END IF;

    IF v_sc_check IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาสิ้นสุดนอกช่วงกะได้ — ตรวจสอบวันและเวลากะทำงาน');
    END IF;
  END IF;

  v_is_locked := public.is_shift_locked(v_shift_calendar_id);
  IF v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถเพิ่มเหตุการณ์ได้');
  END IF;

  IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
  END IF;

  INSERT INTO public.production_events (
    plant_id, line_id, machine_id, shift_calendar_id,
    event_type, reason_id, product_id, start_ts, end_ts, notes, created_by
  ) VALUES (
    v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
    p_event_type, p_reason_id, p_product_id, p_start_ts, p_end_ts, p_notes, v_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'message', 'Manual event created successfully');

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', 'เหตุการณ์ซ้อนทับกับเหตุการณ์อื่นในช่วงเวลานี้');
    ELSIF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถเพิ่มเหตุการณ์ได้');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN', 'message', SQLERRM);
END;
$function$;

-- Update rpc_update_event to check working_days
CREATE OR REPLACE FUNCTION public.rpc_update_event(p_event_id uuid, p_event_type event_type, p_start_ts timestamp with time zone, p_end_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT * INTO v_old FROM production_events WHERE id = p_event_id;
  IF v_old IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Event not found');
  END IF;

  IF NOT has_machine_permission(v_user_id, v_old.machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  IF is_shift_locked(v_old.shift_calendar_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
  END IF;

  -- Validate start_ts within shift window + working_days
  v_start_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;
  v_start_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;

  SELECT sc.id INTO v_sc_check
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = v_old.plant_id
     AND s.is_active = true
     AND sc.shift_date = v_start_local_date
     AND (EXTRACT(DOW FROM v_start_local_date))::int = ANY(s.working_days)
     AND (
       (s.start_time <= s.end_time AND v_start_local_time >= s.start_time AND v_start_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (v_start_local_time >= s.start_time OR v_start_local_time < s.end_time))
     )
   LIMIT 1;

  IF v_sc_check IS NULL THEN
    SELECT sc.id INTO v_sc_check
      FROM shift_calendar sc
      JOIN shifts s ON s.id = sc.shift_id
     WHERE sc.plant_id = v_old.plant_id
       AND s.is_active = true
       AND sc.shift_date = (v_start_local_date - interval '1 day')::date
       AND (EXTRACT(DOW FROM (v_start_local_date - interval '1 day')::date))::int = ANY(s.working_days)
       AND s.start_time > s.end_time
       AND v_start_local_time < s.end_time
     LIMIT 1;
  END IF;

  IF v_sc_check IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  -- Validate end_ts
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
       AND (EXTRACT(DOW FROM v_end_local_date))::int = ANY(s.working_days)
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
         AND (EXTRACT(DOW FROM (v_end_local_date - interval '1 day')::date))::int = ANY(s.working_days)
         AND s.start_time > s.end_time
         AND v_end_local_time <= s.end_time
       LIMIT 1;
    END IF;

    IF v_sc_check IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาสิ้นสุดนอกช่วงกะได้ — ตรวจสอบวันและเวลากะทำงาน');
    END IF;
  END IF;

  -- Bypass overlap and cascade triggers
  PERFORM set_config('app.skip_overlap_check', 'true', true);
  PERFORM set_config('app.skip_cascade', 'true', true);

  -- Cascade to subsequent events
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
    SET start_ts = p_end_ts, updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND start_ts = v_old.start_ts;
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_next := true; END IF;
  END IF;

  -- Adjust previous event
  IF v_old.start_ts IS DISTINCT FROM p_start_ts THEN
    UPDATE production_events
    SET end_ts = p_start_ts, updated_at = now()
    WHERE machine_id = v_old.machine_id
      AND shift_calendar_id = v_old.shift_calendar_id
      AND id != p_event_id
      AND end_ts = v_old.start_ts;
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    IF v_affected_count > 0 THEN v_cascaded_prev := true; END IF;
  END IF;

  -- Update the event
  UPDATE production_events
  SET event_type = p_event_type, start_ts = p_start_ts, end_ts = p_end_ts, notes = p_notes, updated_at = now()
  WHERE id = p_event_id;

  -- Final overlap validation
  SELECT COUNT(*) INTO v_overlap_count
  FROM production_events a
  JOIN production_events b ON a.id < b.id AND a.machine_id = b.machine_id AND a.shift_calendar_id = b.shift_calendar_id
  WHERE a.machine_id = v_old.machine_id AND a.shift_calendar_id = v_old.shift_calendar_id
    AND a.end_ts IS NOT NULL AND b.end_ts IS NOT NULL
    AND a.start_ts < b.end_ts AND b.start_ts < a.end_ts;

  IF v_overlap_count = 0 THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM production_events a
    JOIN production_events b ON a.id != b.id AND a.machine_id = b.machine_id AND a.shift_calendar_id = b.shift_calendar_id
    WHERE a.machine_id = v_old.machine_id AND a.shift_calendar_id = v_old.shift_calendar_id
      AND a.end_ts IS NULL AND b.end_ts IS NULL;
  END IF;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'OVERLAP_AFTER_CASCADE';
  END IF;

  RETURN jsonb_build_object('success', true, 'event_id', p_event_id, 'cascaded_next', v_cascaded_next, 'cascaded_prev', v_cascaded_prev, 'message', 'Event updated successfully');

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%OVERLAP%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', 'เหตุการณ์ซ้อนทับกับเหตุการณ์อื่น กรุณาตรวจสอบเวลาอีกครั้ง');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN', 'message', SQLERRM);
END;
$function$;
