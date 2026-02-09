
CREATE OR REPLACE FUNCTION public.rpc_recalc_oee_for_shift(p_shift_calendar_id UUID)
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
    v_shift_duration_minutes INTEGER;
    v_total_deductions INTEGER;
    v_ppt_template RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can recalculate OEE');
    END IF;

    -- Fetch shift calendar + shift definition
    SELECT sc.*, s.start_time, s.end_time, s.name as shift_name
    INTO v_shift
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    -- Calculate shift duration in minutes (handle overnight shifts)
    v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time)) / 60;
    IF v_shift_duration_minutes <= 0 THEN
        v_shift_duration_minutes := v_shift_duration_minutes + 1440; -- add 24 hours
    END IF;

    -- Look up the most recent active PPT template for this plant+shift with effective_from <= shift_date
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
        -- Calculate total deductions from the template
        v_total_deductions := COALESCE(v_ppt_template.break_minutes, 0)
                            + COALESCE(v_ppt_template.meal_minutes, 0)
                            + COALESCE(v_ppt_template.meeting_minutes, 0)
                            + COALESCE(v_ppt_template.maintenance_minutes, 0)
                            + COALESCE(v_ppt_template.other_minutes, 0);
        v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
    ELSE
        -- Fallback: use shift_calendar.planned_time_minutes
        v_planned_time := v_shift.planned_time_minutes;
    END IF;

    FOR v_machine IN
        SELECT m.*
        FROM public.machines m
        JOIN public.lines l ON m.line_id = l.id
        WHERE l.plant_id = v_shift.plant_id AND m.is_active = true
    LOOP
        -- Calculate weighted ideal cycle time from production_standards
        -- Priority: production_standards (machine+SKU specific) > machine default
        SELECT 
            COALESCE(
                SUM(
                    COALESCE(
                        ps.ideal_cycle_time_seconds,
                        v_machine.ideal_cycle_time_seconds
                    ) *
                    EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))
                ) / NULLIF(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))), 0),
                v_machine.ideal_cycle_time_seconds
            )
        INTO v_ideal_cycle_time
        FROM public.production_events pe
        LEFT JOIN public.production_standards ps 
            ON ps.machine_id = v_machine.id 
            AND ps.product_id = pe.product_id 
            AND ps.is_active = true
        WHERE pe.machine_id = v_machine.id
          AND pe.shift_calendar_id = p_shift_calendar_id
          AND pe.event_type = 'RUN';

        IF v_ideal_cycle_time IS NULL OR v_ideal_cycle_time <= 0 THEN
            v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;
        END IF;

        -- Run time
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_run_time
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type = 'RUN';

        -- Downtime
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_downtime
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type IN ('DOWNTIME', 'SETUP');

        -- Counts
        SELECT 
            COALESCE(SUM(good_qty), 0),
            COALESCE(SUM(reject_qty), 0)
        INTO v_good_qty, v_reject_qty
        FROM public.production_counts
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id;

        -- Availability = Run Time / Planned Production Time
        IF v_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_planned_time) * 100, 100);
        ELSE
            v_availability := 0;
        END IF;

        -- Performance
        IF v_run_time > 0 AND v_ideal_cycle_time > 0 THEN
            v_performance := LEAST(
                ((v_good_qty + v_reject_qty) * (v_ideal_cycle_time / 60)::NUMERIC / v_run_time) * 100,
                100
            );
        ELSE
            v_performance := 0;
        END IF;

        -- Quality
        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)) * 100;
        ELSE
            v_quality := 100;
        END IF;

        v_oee := (v_availability * v_performance * v_quality) / 10000;

        -- Upsert snapshot
        DELETE FROM public.oee_snapshots 
        WHERE scope = 'MACHINE' 
          AND scope_id = v_machine.id 
          AND period = 'SHIFT'
          AND shift_calendar_id = p_shift_calendar_id;

        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            shift_calendar_id,
            availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty
        ) VALUES (
            'MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::TIMESTAMPTZ,
            (v_shift.shift_date || ' ' || v_shift.end_time)::TIMESTAMPTZ,
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
        'planned_time_minutes', v_planned_time,
        'ppt_source', CASE WHEN v_ppt_template IS NOT NULL THEN 'planned_time_templates' ELSE 'shift_calendar_fallback' END,
        'message', 'OEE recalculated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$$;
