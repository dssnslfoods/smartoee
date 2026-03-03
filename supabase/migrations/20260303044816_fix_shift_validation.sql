-- Fix ensure_shift_calendar to return NULL instead of throwing DEBUG_NO_SHIFT exception 
-- so that caller RPCs can gracefully return clear validation errors,
-- AND update rpc_create_manual_event to properly handle the exact end time of a shift.

-- 1. Redefine ensure_shift_calendar
CREATE OR REPLACE FUNCTION public.ensure_shift_calendar(
  p_plant_id UUID,
  p_local_date DATE,
  p_local_time TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sc_id UUID;
  v_shift RECORD;
  v_shift_duration_minutes INTEGER;
  v_planned_time INTEGER;
  v_ppt_template RECORD;
  v_total_deductions INTEGER;
BEGIN
  -- 1) Try to find existing shift_calendar entry (same day)
  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = p_plant_id
     AND s.is_active = true
     AND sc.shift_date = p_local_date
     AND (EXTRACT(DOW FROM p_local_date))::int = ANY(s.working_days)
     AND (
       (s.start_time <= s.end_time AND p_local_time >= s.start_time AND p_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (p_local_time >= s.start_time OR p_local_time < s.end_time))
     )
   LIMIT 1;

  IF v_sc_id IS NOT NULL THEN
    RETURN v_sc_id;
  END IF;

  -- 2) Try previous day for overnight shifts
  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = p_plant_id
     AND s.is_active = true
     AND sc.shift_date = (p_local_date - interval '1 day')::date
     AND (EXTRACT(DOW FROM (p_local_date - interval '1 day')::date))::int = ANY(s.working_days)
     AND s.start_time > s.end_time
     AND p_local_time < s.end_time
   LIMIT 1;

  IF v_sc_id IS NOT NULL THEN
    RETURN v_sc_id;
  END IF;

  -- 3) No shift_calendar found — try to auto-create from shifts table
  -- Check same-day shifts first
  SELECT s.* INTO v_shift
    FROM shifts s
   WHERE s.plant_id = p_plant_id
     AND s.is_active = true
     AND (EXTRACT(DOW FROM p_local_date))::int = ANY(s.working_days)
     AND s.effective_from <= p_local_date
     AND (
       (s.start_time <= s.end_time AND p_local_time >= s.start_time AND p_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (p_local_time >= s.start_time OR p_local_time < s.end_time))
     )
   ORDER BY s.effective_from DESC
   LIMIT 1;

  -- Check previous-day overnight shifts
  IF v_shift IS NULL THEN
    SELECT s.* INTO v_shift
      FROM shifts s
     WHERE s.plant_id = p_plant_id
       AND s.is_active = true
       AND (EXTRACT(DOW FROM (p_local_date - interval '1 day')::date))::int = ANY(s.working_days)
       AND s.effective_from <= (p_local_date - interval '1 day')::date
       AND s.start_time > s.end_time
       AND p_local_time < s.end_time
     ORDER BY s.effective_from DESC
     LIMIT 1;

    IF v_shift IS NOT NULL THEN
      -- For overnight shift, the shift_date is previous day
      p_local_date := (p_local_date - interval '1 day')::date;
    END IF;
  END IF;

  IF v_shift IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check holidays before creating
  IF EXISTS (
    SELECT 1 FROM holidays h
    JOIN plants p ON p.id = p_plant_id
    WHERE h.company_id = p.company_id
      AND (h.plant_id IS NULL OR h.plant_id = p_plant_id)
      AND (
        h.holiday_date = p_local_date
        OR (h.is_recurring = true 
            AND EXTRACT(MONTH FROM h.holiday_date) = EXTRACT(MONTH FROM p_local_date) 
            AND EXTRACT(DAY FROM h.holiday_date) = EXTRACT(DAY FROM p_local_date))
      )
  ) THEN
    RETURN NULL;
  END IF;

  -- Calculate planned_time from PPT template
  v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time))::int / 60;
  IF v_shift_duration_minutes <= 0 THEN
    v_shift_duration_minutes := v_shift_duration_minutes + 1440;
  END IF;

  SELECT * INTO v_ppt_template
    FROM planned_time_templates
   WHERE plant_id = p_plant_id
     AND shift_id = v_shift.id
     AND is_active = true
     AND effective_from <= p_local_date
   ORDER BY effective_from DESC
   LIMIT 1;

  IF v_ppt_template IS NOT NULL THEN
    v_total_deductions := COALESCE(v_ppt_template.break_minutes, 0)
                        + COALESCE(v_ppt_template.meal_minutes, 0)
                        + COALESCE(v_ppt_template.meeting_minutes, 0)
                        + COALESCE(v_ppt_template.maintenance_minutes, 0)
                        + COALESCE(v_ppt_template.other_minutes, 0);
    v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
  ELSE
    v_planned_time := v_shift_duration_minutes;
  END IF;

  -- Auto-create shift_calendar entry
  INSERT INTO shift_calendar (plant_id, shift_id, shift_date, planned_time_minutes)
  VALUES (p_plant_id, v_shift.id, p_local_date, v_planned_time)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_sc_id;

  -- If ON CONFLICT hit, fetch existing
  IF v_sc_id IS NULL THEN
    SELECT sc.id INTO v_sc_id
      FROM shift_calendar sc
     WHERE sc.plant_id = p_plant_id
       AND sc.shift_id = v_shift.id
       AND sc.shift_date = p_local_date
     LIMIT 1;
  END IF;

  RETURN v_sc_id;
END;
$function$;

-- 2. Update rpc_create_manual_event
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

  -- Validate start_ts
  v_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;

  v_shift_calendar_id := ensure_shift_calendar(v_machine.plant_id, v_local_date, v_local_time);

  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  -- Validate end_ts within shift window
  IF p_end_ts IS NOT NULL THEN
    v_end_local_time := ((p_end_ts - interval '1 second') AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_end_local_date := ((p_end_ts - interval '1 second') AT TIME ZONE 'Asia/Bangkok')::DATE;

    v_sc_check := ensure_shift_calendar(v_machine.plant_id, v_end_local_date, v_end_local_time);

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
