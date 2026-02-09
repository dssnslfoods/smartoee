
-- Drop both overloads of rpc_start_event
DROP FUNCTION IF EXISTS public.rpc_start_event(uuid, public.event_type, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_start_event(uuid, public.event_type, uuid, text, uuid);

-- Recreate single strict version (no fallback, Thai error message)
CREATE FUNCTION public.rpc_start_event(
  p_machine_id uuid,
  p_event_type public.event_type,
  p_reason_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
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

  -- Strict: only match active shifts where current time falls within window
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

  -- Check previous day for overnight shifts that started yesterday
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

  -- NO FALLBACK: block if outside active shift window
  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถรันเครื่องจักรได้');
  END IF;

  v_is_locked := public.is_shift_locked(v_shift_calendar_id);
  IF v_is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
  END IF;

  IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
  END IF;

  -- Close any open events
  UPDATE public.production_events
  SET end_ts = now(), updated_at = now()
  WHERE machine_id = p_machine_id AND end_ts IS NULL;

  -- Insert new event
  INSERT INTO public.production_events (
    plant_id, line_id, machine_id, shift_calendar_id,
    event_type, reason_id, product_id, start_ts, notes, created_by
  ) VALUES (
    v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
    p_event_type, p_reason_id, p_product_id, now(), p_notes, v_user_id
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'message', 'Event started successfully'
  );

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
$$;
