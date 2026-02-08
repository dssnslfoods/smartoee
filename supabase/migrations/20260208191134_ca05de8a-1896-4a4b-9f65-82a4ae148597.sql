
-- Create RPC function for manual event creation with custom start/end times
CREATE OR REPLACE FUNCTION public.rpc_create_manual_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_start_ts TIMESTAMPTZ,
    p_end_ts TIMESTAMPTZ DEFAULT NULL,
    p_reason_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
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

    -- Use the start_ts date (in Thai timezone) for shift matching
    v_local_date := (p_start_ts AT TIME ZONE 'Asia/Bangkok')::DATE;

    -- Get shift calendar for the event date - normal shifts
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = v_local_date
      AND s.start_time <= s.end_time
      AND (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME >= s.start_time 
      AND (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME < s.end_time
    LIMIT 1;

    -- Handle overnight shifts
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        JOIN public.shifts s ON sc.shift_id = s.id
        WHERE sc.plant_id = v_machine.plant_id
          AND s.start_time > s.end_time
          AND (
            (sc.shift_date = v_local_date AND (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME >= s.start_time)
            OR
            (sc.shift_date = v_local_date - INTERVAL '1 day' AND (p_start_ts AT TIME ZONE 'Asia/Bangkok')::TIME < s.end_time)
          )
        LIMIT 1;
    END IF;

    -- Fallback: any shift for that date
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        WHERE sc.plant_id = v_machine.plant_id
          AND sc.shift_date = v_local_date
        ORDER BY sc.shift_id
        LIMIT 1;
    END IF;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'No shift calendar found for the selected date');
    END IF;

    -- Check if shift is locked
    v_is_locked := public.is_shift_locked(v_shift_calendar_id);
    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is locked, cannot add events');
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
            RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', SQLERRM);
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
        END IF;
END;
$$;
