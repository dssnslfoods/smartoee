
CREATE OR REPLACE FUNCTION public.rpc_add_counts_backdate(
  p_machine_id uuid,
  p_good_qty integer,
  p_reject_qty integer DEFAULT 0,
  p_defect_reason_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_shift_calendar_id uuid DEFAULT NULL,
  p_ts timestamptz DEFAULT NULL
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

  -- If shift_calendar_id is provided, use it directly (for backdated entry)
  IF p_shift_calendar_id IS NOT NULL THEN
    v_sc_id := p_shift_calendar_id;
    v_ts := COALESCE(p_ts, now());

    -- Verify shift_calendar exists and machine belongs to same plant
    SELECT l.plant_id INTO v_plant_id
      FROM machines m
      JOIN lines l ON l.id = m.line_id
     WHERE m.id = p_machine_id;

    IF NOT EXISTS (
      SELECT 1 FROM shift_calendar sc WHERE sc.id = v_sc_id AND sc.plant_id = v_plant_id
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'Shift calendar ไม่ตรงกับ Plant ของเครื่องจักร');
    END IF;

    -- Check shift lock
    IF is_shift_locked(v_sc_id) THEN
      RETURN json_build_object('ok', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
    END IF;
  ELSE
    -- Fallback to current shift detection (same as rpc_add_counts)
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
           AND sc.shift_date = (v_local_date - interval '1 day')::date
           AND (EXTRACT(DOW FROM (v_local_date - interval '1 day')::date))::int = ANY(s.working_days)
           AND s.start_time > s.end_time
           AND v_local_time < s.end_time
         LIMIT 1;
      END IF;

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
    created_by, ts
  ) VALUES (
    p_machine_id, v_sc_id,
    p_good_qty, p_reject_qty, p_defect_reason_id, p_notes,
    v_user_id, v_ts
  );

  RETURN json_build_object('ok', true);
END;
$function$;
