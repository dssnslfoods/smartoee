-- =============================================
-- RPC FUNCTIONS FOR FRONTEND
-- =============================================

-- =============================================
-- 1. RPC_START_EVENT
-- Start a new production event (RUN/DOWNTIME/SETUP)
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_start_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
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

    -- Get current shift calendar
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = CURRENT_DATE
      AND CURRENT_TIME BETWEEN s.start_time AND s.end_time
    LIMIT 1;

    -- If no shift found for current time, get any shift for today
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        WHERE sc.plant_id = v_machine.plant_id
          AND sc.shift_date = CURRENT_DATE
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
      AND shift_calendar_id = v_shift_calendar_id
      AND end_ts IS NULL;

    -- Insert new event
    INSERT INTO public.production_events (
        plant_id, line_id, machine_id, shift_calendar_id,
        event_type, reason_id, start_ts, notes, created_by
    ) VALUES (
        v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, now(), p_notes, v_user_id
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

-- =============================================
-- 2. RPC_STOP_EVENT
-- Stop the current open event for a machine
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_stop_event(
    p_machine_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_is_locked BOOLEAN;
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

    -- Find open event
    SELECT * INTO v_event
    FROM public.production_events
    WHERE machine_id = p_machine_id AND end_ts IS NULL
    ORDER BY start_ts DESC
    LIMIT 1;

    IF v_event IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'No open event found for this machine');
    END IF;

    -- Check if shift is locked
    v_is_locked := public.is_shift_locked(v_event.shift_calendar_id);
    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is locked, cannot modify events');
    END IF;

    -- Stop the event
    UPDATE public.production_events
    SET end_ts = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event.id,
        'duration_minutes', EXTRACT(EPOCH FROM (now() - v_event.start_ts)) / 60,
        'message', 'Event stopped successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$$;

-- =============================================
-- 3. RPC_ADD_COUNTS
-- Add production counts for a machine
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id UUID,
    p_good_qty INTEGER,
    p_reject_qty INTEGER DEFAULT 0,
    p_defect_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
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

    -- Get current shift calendar
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = CURRENT_DATE
    ORDER BY sc.shift_id
    LIMIT 1;

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

-- =============================================
-- 4. RPC_APPROVE_SHIFT
-- Approve a shift (SUPERVISOR only)
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_approve_shift(
    p_shift_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_plant_id UUID;
    v_current_status public.approval_status;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Check if user is supervisor
    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can approve shifts');
    END IF;

    -- Get plant_id from shift_calendar
    SELECT plant_id INTO v_plant_id
    FROM public.shift_calendar
    WHERE id = p_shift_calendar_id;

    IF v_plant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    -- Check plant permission
    IF NOT public.has_plant_permission(v_user_id, v_plant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this plant');
    END IF;

    -- Check current status
    SELECT status INTO v_current_status
    FROM public.shift_approvals
    WHERE shift_calendar_id = p_shift_calendar_id;

    IF v_current_status = 'LOCKED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is already locked');
    END IF;

    -- Upsert approval
    INSERT INTO public.shift_approvals (shift_calendar_id, status, approved_by, approved_at)
    VALUES (p_shift_calendar_id, 'APPROVED', v_user_id, now())
    ON CONFLICT (shift_calendar_id)
    DO UPDATE SET
        status = 'APPROVED',
        approved_by = v_user_id,
        approved_at = now(),
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'shift_calendar_id', p_shift_calendar_id,
        'status', 'APPROVED',
        'message', 'Shift approved successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$$;

-- =============================================
-- 5. RPC_LOCK_SHIFT
-- Lock a shift (SUPERVISOR only, after approval)
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_lock_shift(
    p_shift_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_plant_id UUID;
    v_current_status public.approval_status;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Check if user is supervisor
    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can lock shifts');
    END IF;

    -- Get plant_id from shift_calendar
    SELECT plant_id INTO v_plant_id
    FROM public.shift_calendar
    WHERE id = p_shift_calendar_id;

    IF v_plant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    -- Check plant permission
    IF NOT public.has_plant_permission(v_user_id, v_plant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this plant');
    END IF;

    -- Check current status (must be APPROVED to lock)
    SELECT status INTO v_current_status
    FROM public.shift_approvals
    WHERE shift_calendar_id = p_shift_calendar_id;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift must be approved before locking');
    END IF;

    IF v_current_status = 'LOCKED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is already locked');
    END IF;

    IF v_current_status != 'APPROVED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift must be approved before locking');
    END IF;

    -- Lock the shift
    UPDATE public.shift_approvals
    SET status = 'LOCKED',
        locked_by = v_user_id,
        locked_at = now(),
        updated_at = now()
    WHERE shift_calendar_id = p_shift_calendar_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_calendar_id', p_shift_calendar_id,
        'status', 'LOCKED',
        'message', 'Shift locked successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$$;

-- =============================================
-- 6. RPC_RECALC_OEE_FOR_SHIFT
-- Recalculate OEE for all machines in a shift
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_recalc_oee_for_shift(
    p_shift_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_shift RECORD;
    v_machine RECORD;
    v_run_time INTEGER;
    v_downtime INTEGER;
    v_planned_time INTEGER;
    v_good_qty INTEGER;
    v_reject_qty INTEGER;
    v_availability NUMERIC(5,2);
    v_performance NUMERIC(5,2);
    v_quality NUMERIC(5,2);
    v_oee NUMERIC(5,2);
    v_ideal_cycle_time NUMERIC;
    v_machines_processed INTEGER := 0;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Only supervisors and admins can recalculate
    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can recalculate OEE');
    END IF;

    -- Get shift info
    SELECT sc.*, s.start_time, s.end_time, s.name as shift_name
    INTO v_shift
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    v_planned_time := v_shift.planned_time_minutes;

    -- Process each machine in this plant
    FOR v_machine IN
        SELECT m.*
        FROM public.machines m
        JOIN public.lines l ON m.line_id = l.id
        WHERE l.plant_id = v_shift.plant_id AND m.is_active = true
    LOOP
        v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;

        -- Calculate run time (RUN events only)
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_run_time
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type = 'RUN';

        -- Calculate downtime (DOWNTIME + SETUP events)
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_downtime
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type IN ('DOWNTIME', 'SETUP');

        -- Get production counts
        SELECT 
            COALESCE(SUM(good_qty), 0),
            COALESCE(SUM(reject_qty), 0)
        INTO v_good_qty, v_reject_qty
        FROM public.production_counts
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id;

        -- Calculate OEE components
        -- Availability = Run Time / Planned Time
        IF v_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_planned_time) * 100, 100);
        ELSE
            v_availability := 0;
        END IF;

        -- Performance = (Total Pieces * Ideal Cycle Time) / Run Time
        IF v_run_time > 0 AND v_ideal_cycle_time > 0 THEN
            v_performance := LEAST(
                ((v_good_qty + v_reject_qty) * (v_ideal_cycle_time / 60)::NUMERIC / v_run_time) * 100,
                100
            );
        ELSE
            v_performance := 0;
        END IF;

        -- Quality = Good Pieces / Total Pieces
        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)) * 100;
        ELSE
            v_quality := 100; -- No production = 100% quality (no defects)
        END IF;

        -- OEE = Availability * Performance * Quality / 10000
        v_oee := (v_availability * v_performance * v_quality) / 10000;

        -- Upsert OEE snapshot for this machine
        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty
        ) VALUES (
            'MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::TIMESTAMPTZ,
            (v_shift.shift_date || ' ' || v_shift.end_time)::TIMESTAMPTZ,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_downtime, v_planned_time,
            v_good_qty, v_reject_qty
        )
        ON CONFLICT (scope, scope_id, period, period_start)
        DO UPDATE SET
            availability = EXCLUDED.availability,
            performance = EXCLUDED.performance,
            quality = EXCLUDED.quality,
            oee = EXCLUDED.oee,
            run_time_minutes = EXCLUDED.run_time_minutes,
            downtime_minutes = EXCLUDED.downtime_minutes,
            good_qty = EXCLUDED.good_qty,
            reject_qty = EXCLUDED.reject_qty;

        v_machines_processed := v_machines_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'shift_calendar_id', p_shift_calendar_id,
        'machines_processed', v_machines_processed,
        'message', 'OEE recalculated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$$;

-- =============================================
-- ADD UNIQUE CONSTRAINT FOR OEE SNAPSHOT UPSERT
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_oee_snapshots_unique 
ON public.oee_snapshots(scope, scope_id, period, period_start);

-- =============================================
-- GRANT EXECUTE PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION public.rpc_start_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_stop_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_approve_shift TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_shift TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_recalc_oee_for_shift TO authenticated;