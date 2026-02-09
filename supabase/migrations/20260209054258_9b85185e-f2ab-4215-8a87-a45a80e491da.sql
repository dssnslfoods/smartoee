
-- Drop and recreate rpc_add_counts
DROP FUNCTION IF EXISTS public.rpc_add_counts(uuid, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.rpc_add_counts(
  p_machine_id uuid,
  p_good_qty integer,
  p_reject_qty integer DEFAULT 0,
  p_defect_reason_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plant_id uuid;
  v_sc_id uuid;
  v_now timestamptz := now();
  v_local_time time;
BEGIN
  -- 1. Resolve plant
  SELECT l.plant_id INTO v_plant_id
    FROM machines m
    JOIN lines l ON l.id = m.line_id
   WHERE m.id = p_machine_id;

  IF v_plant_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Machine not found');
  END IF;

  -- 2. Find current shift calendar – strict time matching only
  v_local_time := (v_now AT TIME ZONE 'Asia/Bangkok')::time;

  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = v_plant_id
     AND s.is_active = true
     AND sc.shift_date = (v_now AT TIME ZONE 'Asia/Bangkok')::date
     AND (
       (s.start_time <= s.end_time AND v_local_time >= s.start_time AND v_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (v_local_time >= s.start_time OR v_local_time < s.end_time))
     )
   LIMIT 1;

  -- Also check previous day for overnight shifts
  IF v_sc_id IS NULL THEN
    SELECT sc.id INTO v_sc_id
      FROM shift_calendar sc
      JOIN shifts s ON s.id = sc.shift_id
     WHERE sc.plant_id = v_plant_id
       AND s.is_active = true
       AND sc.shift_date = ((v_now AT TIME ZONE 'Asia/Bangkok')::date - interval '1 day')::date
       AND s.start_time > s.end_time
       AND v_local_time < s.end_time
     LIMIT 1;
  END IF;

  IF v_sc_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'นอกเวลาทำการ ไม่สามารถบันทึกจำนวนผลิตได้');
  END IF;

  -- 3. Check shift lock
  IF is_shift_locked(v_sc_id) THEN
    RETURN json_build_object('ok', false, 'error', 'กะนี้ถูก Lock แล้ว ไม่สามารถแก้ไขได้');
  END IF;

  -- 4. Insert count
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
$$;
