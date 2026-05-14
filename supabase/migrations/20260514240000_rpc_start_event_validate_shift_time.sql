-- ============================================================================
-- Fix: rpc_start_event และ rpc_add_counts ต้องเช็คเวลาปัจจุบันอยู่ในกะ
-- ----------------------------------------------------------------------------
-- Before: หา shift_calendar ของวันนี้แบบหลวมๆ → ยอมให้ start event นอกเวลากะได้
--         (เช่น CW shift 08:00-17:00 แต่ start event ได้ตอน 21:00)
-- After:  ใช้ ensure_shift_calendar(plant, date_bkk, time_bkk) ที่ validate
--         time bounds → return NULL ถ้านอกเวลา → reject ด้วย OUT_OF_SHIFT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_start_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_std_setup_time_seconds NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_shift_calendar_id UUID;
    v_plant_id UUID;
    v_line_id UUID;
    v_event_id UUID;
    v_local_date DATE;
    v_local_time TIME;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    IF NOT public.has_machine_permission(v_user_id, p_machine_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
    END IF;

    SELECT m.line_id, l.plant_id INTO v_line_id, v_plant_id
      FROM public.machines m JOIN public.lines l ON m.line_id = l.id
     WHERE m.id = p_machine_id AND m.is_active = true;

    IF v_plant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Machine not found or inactive');
    END IF;

    v_local_date := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;
    v_local_time := (NOW() AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_shift_calendar_id := public.ensure_shift_calendar(v_plant_id, v_local_date, v_local_time);

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'OUT_OF_SHIFT',
            'message', 'นอกเวลาทำงาน: ไม่พบกะที่เปิดอยู่ในขณะนี้ — ตรวจสอบตารางกะของโรงงาน'
        );
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals
                WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะปัจจุบันถูก Lock แล้ว');
    END IF;

    UPDATE public.production_events SET end_ts = NOW(), updated_at = NOW()
     WHERE machine_id = p_machine_id AND end_ts IS NULL;

    INSERT INTO public.production_events (
        plant_id, line_id, machine_id, shift_calendar_id,
        event_type, reason_id, product_id, start_ts, notes, created_by,
        std_setup_time_seconds
    ) VALUES (
        v_plant_id, v_line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, p_product_id, NOW(), p_notes, v_user_id,
        p_std_setup_time_seconds
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('event_id', v_event_id));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_start_event(UUID, public.event_type, UUID, TEXT, UUID, NUMERIC)
    TO authenticated, service_role;


-- rpc_add_counts: เหมือนกัน — ใช้ ensure_shift_calendar แทน CURRENT_DATE lookup
CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id        UUID,
    p_good_qty          INT,
    p_reject_qty        INT DEFAULT 0,
    p_defect_reason_id  UUID DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id          UUID;
    v_new_count_id      UUID;
    v_run_event_id      UUID;
    v_local_date        DATE;
    v_local_time        TIME;
BEGIN
    SELECT p.id INTO v_plant_id
      FROM public.machines m
      JOIN public.lines    l ON m.line_id = l.id
      JOIN public.plants   p ON l.plant_id = p.id
     WHERE m.id = p_machine_id;

    v_local_date := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;
    v_local_time := (NOW() AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_shift_calendar_id := public.ensure_shift_calendar(v_plant_id, v_local_date, v_local_time);

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'OUT_OF_SHIFT',
            'message', 'นอกเวลาทำงาน: ไม่พบกะที่เปิดอยู่ในขณะนี้');
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals
                WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'กะปัจจุบันถูก Lock แล้ว');
    END IF;

    SELECT id INTO v_run_event_id
      FROM public.production_events
     WHERE machine_id = p_machine_id AND shift_calendar_id = v_shift_calendar_id
       AND event_type = 'RUN' AND end_ts IS NULL
     ORDER BY start_ts DESC LIMIT 1;

    IF v_run_event_id IS NULL THEN
        SELECT id INTO v_run_event_id
          FROM public.production_events
         WHERE machine_id = p_machine_id AND shift_calendar_id = v_shift_calendar_id
           AND event_type = 'RUN' AND end_ts IS NOT NULL
         ORDER BY end_ts DESC LIMIT 1;
    END IF;

    INSERT INTO public.production_counts (
        shift_calendar_id, machine_id, ts,
        good_qty, reject_qty, defect_reason_id, notes,
        created_by, production_event_id
    ) VALUES (
        v_shift_calendar_id, p_machine_id, NOW(),
        p_good_qty, p_reject_qty, p_defect_reason_id, p_notes,
        auth.uid(), v_run_event_id
    ) RETURNING id INTO v_new_count_id;

    RETURN jsonb_build_object('success', true,
        'data', jsonb_build_object('count_id', v_new_count_id,
            'total_qty', p_good_qty + p_reject_qty,
            'production_event_id', v_run_event_id));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_add_counts(UUID, INT, INT, UUID, TEXT) TO authenticated, service_role;
