
-- Update rpc_add_counts_backdate to accept production_event_id
CREATE OR REPLACE FUNCTION public.rpc_add_counts_backdate(
  p_machine_id uuid,
  p_good_qty integer,
  p_reject_qty integer DEFAULT 0,
  p_defect_reason_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_shift_calendar_id uuid DEFAULT NULL::uuid,
  p_ts timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_production_event_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_plant_id uuid;
  v_sc_id uuid;
  v_ts timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'User not authenticated');
  END IF;

  IF NOT has_machine_permission(v_user_id, p_machine_id) THEN
    RETURN json_build_object('ok', false, 'error', 'No permission for this machine');
  END IF;

  IF p_shift_calendar_id IS NOT NULL THEN
    v_sc_id := p_shift_calendar_id;
    v_ts := COALESCE(p_ts, now());

    SELECT l.plant_id INTO v_plant_id
      FROM machines m
      JOIN lines l ON l.id = m.line_id
     WHERE m.id = p_machine_id;

    IF NOT EXISTS (
      SELECT 1 FROM shift_calendar sc WHERE sc.id = v_sc_id AND sc.plant_id = v_plant_id
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'Shift calendar ไม่ตรงกับ Plant ของเครื่องจักร');
    END IF;

    IF is_shift_locked(v_sc_id) THEN
      RETURN json_build_object('ok', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
    END IF;
  ELSE
    v_ts := now();
    DECLARE
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

      v_local_time := (v_ts AT TIME ZONE 'Asia/Bangkok')::time;
      v_local_date := (v_ts AT TIME ZONE 'Asia/Bangkok')::date;

      v_sc_id := ensure_shift_calendar(v_plant_id, v_local_date, v_local_time);

      IF v_sc_id IS NULL THEN
        RETURN json_build_object('ok', false, 'error', 'นอกเวลาทำการ ไม่สามารถบันทึกจำนวนผลิตได้');
      END IF;

      IF is_shift_locked(v_sc_id) THEN
        RETURN json_build_object('ok', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
      END IF;
    END;
  END IF;

  INSERT INTO production_counts (
    machine_id, shift_calendar_id,
    good_qty, reject_qty, defect_reason_id, notes,
    created_by, ts, production_event_id
  ) VALUES (
    p_machine_id, v_sc_id,
    p_good_qty, p_reject_qty, p_defect_reason_id, p_notes,
    v_user_id, v_ts, p_production_event_id
  );

  RETURN json_build_object('ok', true);
END;
$function$;
