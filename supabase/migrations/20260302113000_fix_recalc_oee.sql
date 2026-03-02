-- =============================================
-- FIX 3: ROBUST OEE RECALCULATION & FUNCTION SYNC
-- Handles dependencies on is_supervisor()
-- =============================================

-- Step 1: Redefine is_supervisor logic without dropping (to avoid RLS dependency errors)
-- We keep both versions but point them to the same robust logic

-- Version A: Parameterized (One argument)
CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = _user_id AND role IN ('SUPERVISOR', 'ADMIN')
    )
$$;

-- Version B: Parameterless (Uses auth.uid())
-- This is the one many RLS policies depend on. We update it to call Version A.
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_supervisor(auth.uid());
$$;

-- Step 2: Clean up OEE Recalculation function overloading
-- We still want to drop the overloaded versions of the RPC to ensure PostgREST picks the right one.
-- These functions usually don't have RLS dependencies.
DROP FUNCTION IF EXISTS public.rpc_recalc_oee_for_shift(UUID);
DROP FUNCTION IF EXISTS public.rpc_recalc_oee_for_shift(UUID, BOOLEAN);

-- Step 3: Create the definitive RPC version
CREATE OR REPLACE FUNCTION public.rpc_recalc_oee_for_shift(
    p_shift_calendar_id UUID, 
    p_force_working_day BOOLEAN DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_machines_skipped INTEGER := 0;
    v_shift_duration_minutes INTEGER;
    v_total_deductions INTEGER;
    v_ppt_template RECORD;
    v_has_events BOOLEAN;
    v_has_counts BOOLEAN;
    v_is_holiday BOOLEAN := false;
    v_holiday_name TEXT;
BEGIN
    -- Authentication check
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Supervisor authorization check
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

    -- Holiday Check
    SELECT h.name INTO v_holiday_name
    FROM public.holidays h
    JOIN public.plants p ON p.id = v_shift.plant_id
    WHERE h.company_id = p.company_id
      AND (h.plant_id IS NULL OR h.plant_id = v_shift.plant_id)
      AND (
        h.holiday_date = v_shift.shift_date
        OR (h.is_recurring = true AND EXTRACT(MONTH FROM h.holiday_date) = EXTRACT(MONTH FROM v_shift.shift_date) AND EXTRACT(DAY FROM h.holiday_date) = EXTRACT(DAY FROM v_shift.shift_date))
      )
    LIMIT 1;

    IF v_holiday_name IS NOT NULL AND NOT p_force_working_day THEN
        v_is_holiday := true;
        -- Cleanup snapshots for this shift if it's now a holiday
        DELETE FROM public.oee_snapshots 
        WHERE period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;

        RETURN jsonb_build_object(
            'success', true,
            'shift_calendar_id', p_shift_calendar_id,
            'is_holiday', true,
            'holiday_name', v_holiday_name,
            'machines_processed', 0,
            'machines_skipped_holiday', 0,
            'message', 'วันนี้เป็นวันหยุดพิเศษ: ' || v_holiday_name || ' — ไม่ต้องคำนวณ OEE'
        );
    END IF;

    -- Calculate Shift Duration and Planned Time
    v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time)) / 60;
    IF v_shift_duration_minutes <= 0 THEN
        v_shift_duration_minutes := v_shift_duration_minutes + 1440;
    END IF;

    -- Check for Planned Time Template
    SELECT *
    INTO v_ppt_template
    FROM public.planned_time_templates
    WHERE plant_id = v_shift.plant_id
      AND shift_id = v_shift.shift_id
      AND is_active = true
      AND effective_from <= v_shift.shift_date
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_ppt_template IS NOT NULL THEN
        v_total_deductions := COALESCE(v_ppt_template.break_minutes, 0)
                            + COALESCE(v_ppt_template.meal_minutes, 0)
                            + COALESCE(v_ppt_template.meeting_minutes, 0)
                            + COALESCE(v_ppt_template.maintenance_minutes, 0)
                            + COALESCE(v_ppt_template.other_minutes, 0);
        v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
    ELSE
        v_planned_time := v_shift.planned_time_minutes;
    END IF;

    -- Process Machines
    FOR v_machine IN
        SELECT m.*
        FROM public.machines m
        JOIN public.lines l ON m.line_id = l.id
        WHERE l.plant_id = v_shift.plant_id AND m.is_active = true
    LOOP
        -- Check if machine has any activity
        SELECT EXISTS (
            SELECT 1 FROM public.production_events
            WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id
        ) INTO v_has_events;

        SELECT EXISTS (
            SELECT 1 FROM public.production_counts
            WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id
        ) INTO v_has_counts;

        -- No activity logic
        IF NOT v_has_events AND NOT v_has_counts THEN
            IF p_force_working_day THEN
                -- Force zero snapshots
                DELETE FROM public.oee_snapshots 
                WHERE scope = 'MACHINE' AND scope_id = v_machine.id 
                  AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;

                INSERT INTO public.oee_snapshots (
                    scope, scope_id, period, period_start, period_end,
                    shift_calendar_id, availability, performance, quality, oee,
                    run_time_minutes, downtime_minutes, planned_time_minutes,
                    good_qty, reject_qty
                ) VALUES (
                    'MACHINE', v_machine.id, 'SHIFT',
                    (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
                    (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
                    p_shift_calendar_id,
                    0, 0, 0, 0,
                    0, v_planned_time, v_planned_time,
                    0, 0
                );
                v_machines_processed := v_machines_processed + 1;
            ELSE
                -- Clean up existing snapshots if any (un-approve case)
                DELETE FROM public.oee_snapshots 
                WHERE scope = 'MACHINE' AND scope_id = v_machine.id AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
                v_machines_skipped := v_machines_skipped + 1;
            END IF;
            CONTINUE;
        END IF;

        -- Calculate Ideal Cycle Time (Weighted by Run Events)
        SELECT 
            COALESCE(
                SUM(COALESCE(ps.ideal_cycle_time_seconds, v_machine.ideal_cycle_time_seconds) *
                    EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))
                ) / NULLIF(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))), 0),
                v_machine.ideal_cycle_time_seconds
            )
        INTO v_ideal_cycle_time
        FROM public.production_events pe
        LEFT JOIN public.production_standards ps 
            ON ps.machine_id = v_machine.id AND ps.product_id = pe.product_id AND ps.is_active = true
        WHERE pe.machine_id = v_machine.id AND pe.shift_calendar_id = p_shift_calendar_id AND pe.event_type = 'RUN';

        IF v_ideal_cycle_time IS NULL OR v_ideal_cycle_time <= 0 THEN
            v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;
        END IF;

        -- Calculate Durations
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60), 0)::INTEGER
        INTO v_run_time
        FROM public.production_events
        WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id AND event_type = 'RUN';

        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60), 0)::INTEGER
        INTO v_downtime
        FROM public.production_events
        WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id AND event_type IN ('DOWNTIME', 'SETUP');

        -- Get Quantities
        SELECT COALESCE(SUM(good_qty), 0), COALESCE(SUM(reject_qty), 0)
        INTO v_good_qty, v_reject_qty
        FROM public.production_counts
        WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id;

        -- Calculate OEE Metrics
        IF v_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_planned_time) * 100, 100);
        ELSE
            v_availability := 0;
        END IF;

        IF v_run_time > 0 AND v_ideal_cycle_time > 0 THEN
            v_performance := LEAST(((v_good_qty + v_reject_qty) * v_ideal_cycle_time / (v_run_time * 60.0)) * 100, 100);
        ELSE
            v_performance := 0;
        END IF;

        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)) * 100;
        ELSE
            v_quality := 0;
        END IF;

        v_oee := (v_availability * v_performance * v_quality) / 10000;

        -- Upsert Machine Snapshot
        DELETE FROM public.oee_snapshots 
        WHERE scope = 'MACHINE' AND scope_id = v_machine.id 
          AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;

        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            shift_calendar_id, availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty
        ) VALUES (
            'MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
            (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
            p_shift_calendar_id,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_downtime, v_planned_time,
            v_good_qty, v_reject_qty
        );

        v_machines_processed := v_machines_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'shift_calendar_id', p_shift_calendar_id,
        'machines_processed', v_machines_processed,
        'machines_skipped', v_machines_skipped,
        'force_working_day', p_force_working_day,
        'message', 'คำนวณ OEE สำเร็จ: ' || v_machines_processed || ' เครื่อง' || 
                   CASE WHEN p_force_working_day THEN ' (ยืนยันวันทำงาน)' ELSE '' END
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$function$;

-- Step 4: Ensure correct permissions
GRANT EXECUTE ON FUNCTION public.rpc_recalc_oee_for_shift(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_recalc_oee_for_shift(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated;
