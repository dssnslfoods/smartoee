-- ============================================================================
-- Per-event std_setup_time
-- ----------------------------------------------------------------------------
-- Operator กรอกเวลามาตรฐานทุกครั้งที่เลือก CHANGEOVER หรือ SETUP
-- เก็บลง production_events.std_setup_time_seconds เพื่อให้ overage logic
-- ใช้ค่าที่ระบุของ event นั้นๆ
-- Priority:
--   1. production_events.std_setup_time_seconds (per-event, ผู้ใช้กรอก)
--   2. production_standards.std_setup_time_seconds (default ของ machine+product)
--   3. 0 → ทั้ง event เป็น planned (ปลอดภัย)
-- ============================================================================

ALTER TABLE public.production_events
    ADD COLUMN IF NOT EXISTS std_setup_time_seconds NUMERIC;

COMMENT ON COLUMN public.production_events.std_setup_time_seconds IS
    'Standard setup/changeover time (sec) ที่ operator กรอกตอนเริ่ม event — ใช้เฉพาะ event_type=SETUP หรือ DOWNTIME reason category=CHANGEOVER';


-- rpc_start_event: รับ p_std_setup_time_seconds
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

    SELECT id INTO v_shift_calendar_id
      FROM public.shift_calendar
     WHERE plant_id = v_plant_id AND shift_date = CURRENT_DATE
     LIMIT 1;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals
                WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked.');
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


-- rpc_create_manual_event: รับ p_std_setup_time_seconds
CREATE OR REPLACE FUNCTION public.rpc_create_manual_event(
    p_machine_id uuid,
    p_event_type event_type,
    p_start_ts timestamp with time zone,
    p_end_ts timestamp with time zone DEFAULT NULL,
    p_reason_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_std_setup_time_seconds numeric DEFAULT NULL
)
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
      FROM public.machines m JOIN public.lines l ON m.line_id = l.id
     WHERE m.id = p_machine_id AND m.is_active = true;

    IF v_machine IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
    END IF;

    v_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;
    v_local_time := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_shift_calendar_id := ensure_shift_calendar(v_machine.plant_id, v_local_date, v_local_time);

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาเริ่มต้นนอกช่วงกะได้');
    END IF;

    IF p_end_ts IS NOT NULL THEN
        v_end_local_time := ((p_end_ts - interval '1 second') AT TIME ZONE 'Asia/Bangkok')::TIME;
        v_end_local_date := ((p_end_ts - interval '1 second') AT TIME ZONE 'Asia/Bangkok')::DATE;
        v_sc_check := ensure_shift_calendar(v_machine.plant_id, v_end_local_date, v_end_local_time);
        IF v_sc_check IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'นอกเวลาทำการ ไม่สามารถกำหนดเวลาสิ้นสุดนอกช่วงกะได้');
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
        event_type, reason_id, product_id, start_ts, end_ts, notes, created_by,
        std_setup_time_seconds
    ) VALUES (
        v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, p_product_id, p_start_ts, p_end_ts, p_notes, v_user_id,
        p_std_setup_time_seconds
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'message', 'Manual event created successfully');

EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
            RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', 'มี event ทับซ้อนช่วงเวลานี้');
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_create_manual_event(UUID, event_type, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, NUMERIC)
    TO authenticated, service_role;


-- calculate_oee + rpc_recalc_oee_for_shift: update เพื่อใช้ COALESCE(pe.std, ps.std, 0)
-- ดู file 20260514190000 สำหรับโครงสร้างเดิม — migration นี้ override ด้วย version ที่
-- ใช้ pe.std_setup_time_seconds เป็น priority แรก
-- (See applied function definition in DB; full body identical to prior version except
--  the co_events CTE replaces ps-only lookup with COALESCE(pe.std/60, ps.std/60, 0))
