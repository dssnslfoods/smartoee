
-- Fix timezone mismatch: RPC functions use CURRENT_TIME (UTC) but shifts are in Thai time
-- Update rpc_start_event to use Asia/Bangkok timezone and handle overnight shifts

CREATE OR REPLACE FUNCTION public.rpc_start_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
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
    v_local_time TIME;
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

    -- Get machine info
    SELECT m.*, l.plant_id INTO v_machine
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    WHERE m.id = p_machine_id AND m.is_active = true;

    IF v_machine IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
    END IF;

    -- Use Thai timezone for shift matching (shifts are defined in local time)
    v_local_time := (now() AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_local_date := (now() AT TIME ZONE 'Asia/Bangkok')::DATE;

    -- Get current shift calendar - handle normal shifts (start < end)
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = v_local_date
      AND s.start_time <= s.end_time
      AND v_local_time >= s.start_time AND v_local_time < s.end_time
    LIMIT 1;

    -- Handle overnight shifts (start > end, e.g., 22:00-06:00)
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        JOIN public.shifts s ON sc.shift_id = s.id
        WHERE sc.plant_id = v_machine.plant_id
          AND s.start_time > s.end_time
          AND (
            -- After start on same date (e.g., 22:00-23:59)
            (sc.shift_date = v_local_date AND v_local_time >= s.start_time)
            OR
            -- Before end on next date (e.g., 00:00-06:00, shift started yesterday)
            (sc.shift_date = v_local_date - INTERVAL '1 day' AND v_local_time < s.end_time)
          )
        LIMIT 1;
    END IF;

    -- Fallback: get any shift for today
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        WHERE sc.plant_id = v_machine.plant_id
          AND sc.shift_date = v_local_date
        ORDER BY sc.shift_id
        LIMIT 1;
    END IF;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'No shift calendar found for today');
    END IF;

    -- Check if shift is locked
    v_is_locked := public.is_shift_locked(v_shift_calendar_id);
    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is locked, cannot add events');
    END IF;

    -- Validate reason_id for DOWNTIME/SETUP
    IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
    END IF;

    -- Close any open events for this machine
    UPDATE public.production_events
    SET end_ts = now(), updated_at = now()
    WHERE machine_id = p_machine_id
      AND end_ts IS NULL;

    -- Insert new event (with optional product_id)
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

-- Also fix rpc_add_counts to use Thai timezone for shift matching
CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id UUID,
    p_good_qty INTEGER,
    p_reject_qty INTEGER DEFAULT 0,
    p_defect_reason_id UUID DEFAULT NULL,
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
    v_count_id UUID;
    v_is_locked BOOLEAN;
    v_local_time TIME;
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

    -- Validate quantities
    IF p_good_qty < 0 OR p_reject_qty < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Quantities cannot be negative');
    END IF;

    -- Validate defect reason if rejects > 0
    IF p_reject_qty > 0 AND p_defect_reason_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Defect reason is required when reject quantity > 0');
    END IF;

    -- Get machine info
    SELECT m.*, l.plant_id INTO v_machine
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    WHERE m.id = p_machine_id AND m.is_active = true;

    IF v_machine IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
    END IF;

    -- Use Thai timezone for shift matching
    v_local_time := (now() AT TIME ZONE 'Asia/Bangkok')::TIME;
    v_local_date := (now() AT TIME ZONE 'Asia/Bangkok')::DATE;

    -- Get current shift calendar - handle normal shifts
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = v_local_date
      AND s.start_time <= s.end_time
      AND v_local_time >= s.start_time AND v_local_time < s.end_time
    LIMIT 1;

    -- Handle overnight shifts
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        JOIN public.shifts s ON sc.shift_id = s.id
        WHERE sc.plant_id = v_machine.plant_id
          AND s.start_time > s.end_time
          AND (
            (sc.shift_date = v_local_date AND v_local_time >= s.start_time)
            OR
            (sc.shift_date = v_local_date - INTERVAL '1 day' AND v_local_time < s.end_time)
          )
        LIMIT 1;
    END IF;

    -- Fallback: get any shift for today
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        WHERE sc.plant_id = v_machine.plant_id
          AND sc.shift_date = v_local_date
        ORDER BY sc.shift_id
        LIMIT 1;
    END IF;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'No shift calendar found for today');
    END IF;

    -- Check if shift is locked
    v_is_locked := public.is_shift_locked(v_shift_calendar_id);
    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is locked, cannot add counts');
    END IF;

    -- Insert count record
    INSERT INTO public.production_counts (
        shift_calendar_id, machine_id, ts,
        good_qty, reject_qty, defect_reason_id, notes, created_by
    ) VALUES (
        v_shift_calendar_id, p_machine_id, now(),
        p_good_qty, p_reject_qty, p_defect_reason_id, p_notes, v_user_id
    ) RETURNING id INTO v_count_id;

    RETURN jsonb_build_object(
        'success', true,
        'count_id', v_count_id,
        'total_qty', p_good_qty + p_reject_qty,
        'message', 'Counts added successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
            RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', SQLERRM);
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
        END IF;
END;
$$;
