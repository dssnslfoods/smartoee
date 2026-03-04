-- =============================================
-- 5. API RPC FUNCTIONS (PRODUCTION EVENTS & COUNTS)
-- =============================================

-- rpc_start_event
CREATE OR REPLACE FUNCTION public.rpc_start_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id UUID;
    v_line_id UUID;
    v_new_event_id UUID;
BEGIN
    -- 1. Get current active shift for the machine's plant
    SELECT p.id, m.line_id INTO v_plant_id, v_line_id
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    JOIN public.plants p ON l.plant_id = p.id
    WHERE m.id = p_machine_id;

    IF v_plant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Machine not found');
    END IF;

    -- Find active shift calendar (simplified to today for this RPC, should ideally check time overlaps based on shifts table)
    SELECT id INTO v_shift_calendar_id
    FROM public.shift_calendar
    WHERE plant_id = v_plant_id AND shift_date = CURRENT_DATE
    LIMIT 1;

    -- Auto-create shift calendar if not exists (using a default shift for simplicity if needed, or rely on ensure_shift_calendar)
    IF v_shift_calendar_id IS NULL THEN
        -- Fallback: Call the ensure function (assuming it exists or we just fail gracefully)
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found for today. Please create one.');
    END IF;

    -- 2. Check if shift is locked
    IF EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked. Cannot start event.');
    END IF;

    -- 3. Auto-stop any currently running event for this machine
    UPDATE public.production_events
    SET end_ts = NOW(), updated_at = NOW()
    WHERE machine_id = p_machine_id AND end_ts IS NULL;

    -- 4. Insert the new event
    INSERT INTO public.production_events (
        plant_id, line_id, machine_id, shift_calendar_id, 
        event_type, reason_id, product_id, start_ts, notes, created_by
    ) VALUES (
        v_plant_id, v_line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, p_product_id, NOW(), p_notes, auth.uid()
    ) RETURNING id INTO v_new_event_id;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('event_id', v_new_event_id));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

-- rpc_stop_event
CREATE OR REPLACE FUNCTION public.rpc_stop_event(
    p_machine_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
    v_start_ts TIMESTAMPTZ;
    v_duration_minutes NUMERIC;
BEGIN
    SELECT id, start_ts INTO v_event_id, v_start_ts
    FROM public.production_events
    WHERE machine_id = p_machine_id AND end_ts IS NULL
    ORDER BY start_ts DESC
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active event found to stop.');
    END IF;

    UPDATE public.production_events
    SET end_ts = NOW(), notes = COALESCE(p_notes, notes), updated_at = NOW()
    WHERE id = v_event_id;

    v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_start_ts)) / 60.0;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('event_id', v_event_id, 'duration_minutes', v_duration_minutes));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

-- rpc_add_counts
CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id UUID,
    p_good_qty INT,
    p_reject_qty INT DEFAULT 0,
    p_defect_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id UUID;
    v_new_count_id UUID;
BEGIN
    SELECT p.id INTO v_plant_id
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    JOIN public.plants p ON l.plant_id = p.id
    WHERE m.id = p_machine_id;

    SELECT id INTO v_shift_calendar_id
    FROM public.shift_calendar
    WHERE plant_id = v_plant_id AND shift_date = CURRENT_DATE
    LIMIT 1;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked.');
    END IF;

    INSERT INTO public.production_counts (
        shift_calendar_id, machine_id, ts, good_qty, reject_qty, defect_reason_id, notes, created_by
    ) VALUES (
        v_shift_calendar_id, p_machine_id, NOW(), p_good_qty, p_reject_qty, p_defect_reason_id, p_notes, auth.uid()
    ) RETURNING id INTO v_new_count_id;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('count_id', v_new_count_id, 'total_qty', p_good_qty + p_reject_qty));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

-- rpc_approve_shift
CREATE OR REPLACE FUNCTION public.rpc_approve_shift(p_shift_calendar_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.shift_approvals (shift_calendar_id, status, approved_by, approved_at)
    VALUES (p_shift_calendar_id, 'APPROVED', auth.uid(), NOW())
    ON CONFLICT (shift_calendar_id) DO UPDATE 
    SET status = 'APPROVED', approved_by = auth.uid(), approved_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'status', 'APPROVED'));
END;
$$;

-- rpc_lock_shift
CREATE OR REPLACE FUNCTION public.rpc_lock_shift(p_shift_calendar_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.shift_approvals (shift_calendar_id, status, locked_by, locked_at)
    VALUES (p_shift_calendar_id, 'LOCKED', auth.uid(), NOW())
    ON CONFLICT (shift_calendar_id) DO UPDATE 
    SET status = 'LOCKED', locked_by = auth.uid(), locked_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'status', 'LOCKED'));
END;
$$;

-- rpc_unlock_shift
CREATE OR REPLACE FUNCTION public.rpc_unlock_shift(p_shift_calendar_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_deleted_count INTEGER;
BEGIN
    -- 1. Check supervisor role
    IF NOT public.is_supervisor() THEN
        RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'PERMISSION_DENIED', 'message', 'ต้องเป็น Supervisor เท่านั้น');
    END IF;

    -- 2. Verify status is LOCKED
    IF NOT EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = p_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'NOT_LOCKED', 'message', 'กะนี้ยังไม่ได้ล็อค หรือไม่พบข้อมูล');
    END IF;

    -- 3. Unlock: revert to DRAFT status
    UPDATE public.shift_approvals
    SET status = 'DRAFT',
        approved_by = NULL,
        approved_at = NULL,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = NOW()
    WHERE shift_calendar_id = p_shift_calendar_id;

    -- 4. Delete OEE Snapshots for this shift to force recalculation
    DELETE FROM public.oee_snapshots
    WHERE period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 5. Audit log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_user_id, after_json)
    VALUES ('UNLOCK', 'shift_approval', p_shift_calendar_id, v_user_id,
            jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'oee_snapshots_deleted', v_deleted_count));

    RETURN jsonb_build_object('success', true, 'ok', true, 'data', jsonb_build_object('shift_calendar_id', p_shift_calendar_id, 'oee_snapshots_deleted', v_deleted_count));
END;
$$;
