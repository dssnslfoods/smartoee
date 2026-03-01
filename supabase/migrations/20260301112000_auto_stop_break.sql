-- 1. Helper Function: is_shift_locked
CREATE OR REPLACE FUNCTION public.is_shift_locked(p_shift_calendar_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shift_approvals 
        WHERE shift_calendar_id = p_shift_calendar_id 
          AND status = 'LOCKED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper Function: check_is_in_break
CREATE OR REPLACE FUNCTION public.check_is_in_break(p_shift_calendar_id UUID, p_local_time TIME)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_in_break BOOLEAN := FALSE;
BEGIN
    SELECT 
        CASE 
            WHEN p_local_time >= break_start_time AND p_local_time < break_end_time THEN TRUE
            ELSE FALSE
        END INTO v_is_in_break
    FROM public.planned_time_templates ptt
    JOIN public.shift_calendar sc ON ptt.shift_id = sc.shift_id AND ptt.plant_id = sc.plant_id
    WHERE sc.id = p_shift_calendar_id
      AND ptt.is_active = true
      AND ptt.effective_from <= sc.shift_date
      AND ptt.break_start_time IS NOT NULL 
      AND ptt.break_end_time IS NOT NULL
    ORDER BY ptt.effective_from DESC
    LIMIT 1;

    RETURN COALESCE(v_is_in_break, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update rpc_start_event to block during break
DROP FUNCTION IF EXISTS public.rpc_start_event(uuid, public.event_type, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.rpc_start_event(p_machine_id uuid, p_event_type public.event_type, p_reason_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_product_id uuid DEFAULT NULL::uuid)
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

  IF NOT public.has_machine_access(p_machine_id) THEN
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

  -- Use ensure_shift_calendar with fallback auto-creation
  v_shift_calendar_id := ensure_shift_calendar(v_machine.plant_id, v_local_date, v_local_time);

  IF v_shift_calendar_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถรันเครื่องจักรได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  -- BLOCK DURING BREAK PERIOD
  IF public.check_is_in_break(v_shift_calendar_id, v_local_time) THEN
     RETURN jsonb_build_object('success', false, 'error', 'BREAK_PERIOD', 'message', 'อยู่ในช่วงเวลาพัก ไม่สามารถเริ่มงานได้ — ตรวจสอบเวลาพักใน Planned Time');
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

-- 4. Update rpc_add_counts to block during break
DROP FUNCTION IF EXISTS public.rpc_add_counts(uuid, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.rpc_add_counts(p_machine_id uuid, p_good_qty integer, p_reject_qty integer DEFAULT 0, p_defect_reason_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
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
  IF NOT public.has_machine_access(p_machine_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
  END IF;

  SELECT l.plant_id INTO v_plant_id
    FROM machines m
    JOIN lines l ON l.id = m.line_id
   WHERE m.id = p_machine_id;

  IF v_plant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Machine not found');
  END IF;

  v_local_time := (v_now AT TIME ZONE 'Asia/Bangkok')::time;
  v_local_date := (v_now AT TIME ZONE 'Asia/Bangkok')::date;

  -- Use ensure_shift_calendar with fallback auto-creation
  v_sc_id := ensure_shift_calendar(v_plant_id, v_local_date, v_local_time);

  IF v_sc_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'นอกเวลาทำการ ไม่สามารถบันทึกจำนวนผลิตได้ — ตรวจสอบวันและเวลากะทำงาน');
  END IF;

  -- BLOCK DURING BREAK PERIOD
  IF public.check_is_in_break(v_sc_id, v_local_time) THEN
     RETURN jsonb_build_object('success', false, 'error', 'BREAK_PERIOD', 'message', 'อยู่ในช่วงเวลาพัก ไม่สามารถเริ่มงานได้ — ตรวจสอบเวลาพักใน Planned Time');
  END IF;

  IF is_shift_locked(v_sc_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
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

  RETURN jsonb_build_object('success', true);
END;
$function$;
