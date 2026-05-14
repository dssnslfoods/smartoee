-- ============================================================================
-- SMED Changeover Overage Logic
-- ----------------------------------------------------------------------------
-- กฎ: สำหรับ DOWNTIME ที่ reason.category='CHANGEOVER' และ SETUP events
--   • lookup std จาก production_standards.std_setup_time_seconds (per machine+product)
--   • ถ้า std > 0:
--       planned_portion = LEAST(actual, std)        → ไม่ลด Availability
--       overage         = GREATEST(actual-std, 0)   → ลด Availability
--   • ถ้า std = 0 (ยังไม่ตั้งมาตรฐาน):
--       ทั้งหมดเป็น planned (ปลอดภัยจน admin ตั้งค่า)
--
-- + Helper RPC `rpc_get_std_setup_time(machine, product)` สำหรับ UI hint
-- ============================================================================

-- 1) calculate_oee — SMED overage logic
CREATE OR REPLACE FUNCTION public.calculate_oee(p_shift_calendar_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_planned_time      INT;
    v_planned_reason    INT;
    v_co_planned        INT;
    v_co_overage        INT;
    v_planned_downtime  INT;
    v_unplanned_reason  INT;
    v_unplanned_dt      INT;
    v_run_time          INT;
    v_adj_planned_time  INT;
    v_good_qty          INT;
    v_reject_qty        INT;
    v_ideal_cycle_time  NUMERIC;
    v_availability      NUMERIC;
    v_performance       NUMERIC;
    v_quality           NUMERIC;
    v_oee               NUMERIC;
    v_shift_start       TIMESTAMPTZ;
    v_shift_end         TIMESTAMPTZ;
    v_shift             RECORD;
    machine_record      RECORD;
BEGIN
    SELECT sc.planned_time_minutes, sc.shift_date, s.start_time, s.end_time
      INTO v_shift
      FROM public.shift_calendar sc
      JOIN public.shifts s ON s.id = sc.shift_id
     WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN RETURN; END IF;

    v_planned_time := v_shift.planned_time_minutes;
    v_shift_start  := (v_shift.shift_date || ' ' || v_shift.start_time)::TIMESTAMPTZ;
    v_shift_end    := (v_shift.shift_date || ' ' || v_shift.end_time)::TIMESTAMPTZ;
    IF v_shift_end <= v_shift_start THEN v_shift_end := v_shift_end + interval '1 day'; END IF;

    FOR machine_record IN
        SELECT DISTINCT machine_id FROM public.production_counts WHERE shift_calendar_id = p_shift_calendar_id
        UNION
        SELECT DISTINCT machine_id FROM public.production_events WHERE shift_calendar_id = p_shift_calendar_id
    LOOP
        -- Run time
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts))/60), 0)::INT
          INTO v_run_time
          FROM public.production_events
         WHERE shift_calendar_id = p_shift_calendar_id
           AND machine_id        = machine_record.machine_id
           AND event_type        = 'RUN';

        -- PLANNED reasons (excludes CHANGEOVER) — full duration
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60), 0)::INT
          INTO v_planned_reason
          FROM public.production_events pe
          JOIN public.downtime_reasons  dr ON dr.id = pe.reason_id
         WHERE pe.shift_calendar_id = p_shift_calendar_id
           AND pe.machine_id        = machine_record.machine_id
           AND pe.event_type        = 'DOWNTIME'
           AND dr.category          = 'PLANNED';

        -- CHANGEOVER + SETUP: split into planned_portion + overage
        WITH co_events AS (
            SELECT EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60 AS actual_min,
                   COALESCE(ps.std_setup_time_seconds / 60.0, 0) AS std_min
              FROM public.production_events pe
              LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
              LEFT JOIN public.production_standards ps
                     ON ps.machine_id = pe.machine_id
                    AND ps.product_id = pe.product_id
                    AND ps.is_active  = true
             WHERE pe.shift_calendar_id = p_shift_calendar_id
               AND pe.machine_id        = machine_record.machine_id
               AND (
                     (pe.event_type = 'DOWNTIME' AND dr.category = 'CHANGEOVER')
                  OR pe.event_type = 'SETUP'
                   )
        )
        SELECT
            COALESCE(SUM(CASE WHEN std_min > 0 THEN LEAST(actual_min, std_min) ELSE actual_min END), 0)::INT,
            COALESCE(SUM(CASE WHEN std_min > 0 THEN GREATEST(actual_min - std_min, 0) ELSE 0 END), 0)::INT
          INTO v_co_planned, v_co_overage
          FROM co_events;

        -- UNPLANNED, BREAKDOWN, PERFORMANCE_LOSS, NULL
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60), 0)::INT
          INTO v_unplanned_reason
          FROM public.production_events pe
          LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
         WHERE pe.shift_calendar_id = p_shift_calendar_id
           AND pe.machine_id        = machine_record.machine_id
           AND pe.event_type        = 'DOWNTIME'
           AND (dr.category IS NULL OR dr.category IN ('UNPLANNED', 'BREAKDOWN', 'PERFORMANCE_LOSS'));

        v_planned_downtime := v_planned_reason + v_co_planned;
        v_unplanned_dt     := v_unplanned_reason + v_co_overage;

        v_adj_planned_time := GREATEST(v_planned_time - v_planned_downtime, 0);

        SELECT COALESCE(SUM(good_qty), 0), COALESCE(SUM(reject_qty), 0)
          INTO v_good_qty, v_reject_qty
          FROM public.production_counts
         WHERE shift_calendar_id = p_shift_calendar_id
           AND machine_id        = machine_record.machine_id;

        SELECT ideal_cycle_time_seconds INTO v_ideal_cycle_time
          FROM public.machines WHERE id = machine_record.machine_id;

        IF v_adj_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_adj_planned_time) * 100, 100);
        ELSE
            v_availability := 0;
        END IF;

        IF v_run_time > 0 AND v_ideal_cycle_time > 0 THEN
            v_performance := LEAST((((v_good_qty + v_reject_qty) * v_ideal_cycle_time) / (v_run_time * 60.0)) * 100, 100);
        ELSE
            v_performance := 0;
        END IF;

        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)) * 100;
        ELSE
            v_quality := 0;
        END IF;

        v_oee := (v_availability * v_performance * v_quality) / 10000;

        DELETE FROM public.oee_snapshots
         WHERE shift_calendar_id = p_shift_calendar_id
           AND scope             = 'MACHINE'
           AND scope_id          = machine_record.machine_id
           AND period            = 'SHIFT';

        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty, shift_calendar_id
        ) VALUES (
            'MACHINE', machine_record.machine_id, 'SHIFT', v_shift_start, v_shift_end,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_unplanned_dt, v_adj_planned_time,
            v_good_qty, v_reject_qty, p_shift_calendar_id
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_oee(UUID) TO authenticated, service_role;


-- 2) rpc_recalc_oee_for_shift — same overage logic (production path)
CREATE OR REPLACE FUNCTION public.rpc_recalc_oee_for_shift(
    p_shift_calendar_id  UUID,
    p_force_working_day  BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id              UUID;
    v_shift                RECORD;
    v_machine              RECORD;
    v_ppt_template         RECORD;
    v_run_time             INTEGER;
    v_planned_reason       INTEGER;
    v_co_planned           INTEGER;
    v_co_overage           INTEGER;
    v_planned_downtime     INTEGER;
    v_unplanned_reason     INTEGER;
    v_unplanned_dt         INTEGER;
    v_planned_time         INTEGER;
    v_adj_planned_time     INTEGER;
    v_good_qty             INTEGER;
    v_reject_qty           INTEGER;
    v_availability         NUMERIC(5,2);
    v_performance          NUMERIC(5,2);
    v_quality              NUMERIC(5,2);
    v_oee                  NUMERIC(5,2);
    v_ideal_cycle_time     NUMERIC;
    v_machines_processed   INTEGER := 0;
    v_machines_skipped     INTEGER := 0;
    v_shift_duration_minutes INTEGER;
    v_total_deductions     INTEGER;
    v_has_events           BOOLEAN;
    v_has_counts           BOOLEAN;
    v_holiday_name         TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can recalculate OEE');
    END IF;

    SELECT sc.*, s.start_time, s.end_time, s.name AS shift_name
      INTO v_shift
      FROM public.shift_calendar sc
      JOIN public.shifts s ON sc.shift_id = s.id
     WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    SELECT h.name INTO v_holiday_name
      FROM public.holidays h
      JOIN public.plants    p ON p.id = v_shift.plant_id
     WHERE h.company_id = p.company_id
       AND (h.plant_id IS NULL OR h.plant_id = v_shift.plant_id)
       AND (
            h.holiday_date = v_shift.shift_date
            OR (h.is_recurring = true
                AND EXTRACT(MONTH FROM h.holiday_date) = EXTRACT(MONTH FROM v_shift.shift_date)
                AND EXTRACT(DAY   FROM h.holiday_date) = EXTRACT(DAY   FROM v_shift.shift_date))
           )
     LIMIT 1;

    IF v_holiday_name IS NOT NULL AND NOT p_force_working_day THEN
        DELETE FROM public.oee_snapshots WHERE period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
        RETURN jsonb_build_object('success', true, 'shift_calendar_id', p_shift_calendar_id,
            'is_holiday', true, 'holiday_name', v_holiday_name,
            'machines_processed', 0, 'machines_skipped_holiday', 0,
            'message', 'วันนี้เป็นวันหยุดพิเศษ: ' || v_holiday_name || ' — ไม่ต้องคำนวณ OEE');
    END IF;

    v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time))::INT / 60;
    IF v_shift_duration_minutes <= 0 THEN
        v_shift_duration_minutes := v_shift_duration_minutes + 1440;
    END IF;

    SELECT *
      INTO v_ppt_template
      FROM public.planned_time_templates
     WHERE plant_id = v_shift.plant_id AND shift_id = v_shift.shift_id
       AND is_active = true AND effective_from <= v_shift.shift_date
     ORDER BY effective_from DESC LIMIT 1;

    IF FOUND THEN
        v_total_deductions := COALESCE(v_ppt_template.break_minutes, 0)
                            + COALESCE(v_ppt_template.meal_minutes, 0)
                            + COALESCE(v_ppt_template.meeting_minutes, 0)
                            + COALESCE(v_ppt_template.maintenance_minutes, 0)
                            + COALESCE(v_ppt_template.other_minutes, 0);
        v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
    ELSE
        v_planned_time := v_shift.planned_time_minutes;
    END IF;

    FOR v_machine IN
        SELECT m.* FROM public.machines m JOIN public.lines l ON m.line_id = l.id
         WHERE l.plant_id = v_shift.plant_id AND m.is_active = true
    LOOP
        SELECT EXISTS (SELECT 1 FROM public.production_events
                        WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id)
          INTO v_has_events;
        SELECT EXISTS (SELECT 1 FROM public.production_counts
                        WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id)
          INTO v_has_counts;

        IF NOT v_has_events AND NOT v_has_counts THEN
            IF p_force_working_day THEN
                DELETE FROM public.oee_snapshots
                 WHERE scope = 'MACHINE' AND scope_id = v_machine.id
                   AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
                INSERT INTO public.oee_snapshots (
                    scope, scope_id, period, period_start, period_end,
                    shift_calendar_id, availability, performance, quality, oee,
                    run_time_minutes, downtime_minutes, planned_time_minutes,
                    good_qty, reject_qty
                ) VALUES ('MACHINE', v_machine.id, 'SHIFT',
                    (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
                    (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
                    p_shift_calendar_id, 0, 0, 0, 0, 0, 0, v_planned_time, 0, 0);
                v_machines_processed := v_machines_processed + 1;
            ELSE
                DELETE FROM public.oee_snapshots
                 WHERE scope = 'MACHINE' AND scope_id = v_machine.id
                   AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
                v_machines_skipped := v_machines_skipped + 1;
            END IF;
            CONTINUE;
        END IF;

        SELECT COALESCE(
                   SUM(COALESCE(ps.ideal_cycle_time_seconds, v_machine.ideal_cycle_time_seconds)
                       * EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)))
                 / NULLIF(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))), 0),
                   v_machine.ideal_cycle_time_seconds)
          INTO v_ideal_cycle_time
          FROM public.production_events pe
          LEFT JOIN public.production_standards ps
                 ON ps.machine_id = v_machine.id AND ps.product_id = pe.product_id AND ps.is_active = true
         WHERE pe.machine_id = v_machine.id AND pe.shift_calendar_id = p_shift_calendar_id AND pe.event_type = 'RUN';

        IF v_ideal_cycle_time IS NULL OR v_ideal_cycle_time <= 0 THEN
            v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;
        END IF;

        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60), 0)::INTEGER
          INTO v_run_time
          FROM public.production_events
         WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id AND event_type = 'RUN';

        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60), 0)::INTEGER
          INTO v_planned_reason
          FROM public.production_events pe
          JOIN public.downtime_reasons  dr ON dr.id = pe.reason_id
         WHERE pe.machine_id = v_machine.id AND pe.shift_calendar_id = p_shift_calendar_id
           AND pe.event_type = 'DOWNTIME' AND dr.category = 'PLANNED';

        WITH co_events AS (
            SELECT EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60 AS actual_min,
                   COALESCE(ps.std_setup_time_seconds / 60.0, 0) AS std_min
              FROM public.production_events pe
              LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
              LEFT JOIN public.production_standards ps
                     ON ps.machine_id = pe.machine_id
                    AND ps.product_id = pe.product_id
                    AND ps.is_active  = true
             WHERE pe.machine_id = v_machine.id AND pe.shift_calendar_id = p_shift_calendar_id
               AND (
                     (pe.event_type = 'DOWNTIME' AND dr.category = 'CHANGEOVER')
                  OR pe.event_type = 'SETUP'
                   )
        )
        SELECT
            COALESCE(SUM(CASE WHEN std_min > 0 THEN LEAST(actual_min, std_min) ELSE actual_min END), 0)::INT,
            COALESCE(SUM(CASE WHEN std_min > 0 THEN GREATEST(actual_min - std_min, 0) ELSE 0 END), 0)::INT
          INTO v_co_planned, v_co_overage
          FROM co_events;

        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60), 0)::INTEGER
          INTO v_unplanned_reason
          FROM public.production_events pe
          LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
         WHERE pe.machine_id = v_machine.id AND pe.shift_calendar_id = p_shift_calendar_id
           AND pe.event_type = 'DOWNTIME'
           AND (dr.category IS NULL OR dr.category IN ('UNPLANNED', 'BREAKDOWN', 'PERFORMANCE_LOSS'));

        v_planned_downtime := v_planned_reason + v_co_planned;
        v_unplanned_dt     := v_unplanned_reason + v_co_overage;

        v_adj_planned_time := GREATEST(v_planned_time - v_planned_downtime, 0);

        SELECT COALESCE(SUM(good_qty), 0), COALESCE(SUM(reject_qty), 0)
          INTO v_good_qty, v_reject_qty
          FROM public.production_counts
         WHERE machine_id = v_machine.id AND shift_calendar_id = p_shift_calendar_id;

        IF v_adj_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_adj_planned_time) * 100, 100);
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

        DELETE FROM public.oee_snapshots
         WHERE scope = 'MACHINE' AND scope_id = v_machine.id
           AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            shift_calendar_id, availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty
        ) VALUES ('MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
            (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
            p_shift_calendar_id, v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_unplanned_dt, v_adj_planned_time, v_good_qty, v_reject_qty);

        v_machines_processed := v_machines_processed + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'shift_calendar_id', p_shift_calendar_id,
        'machines_processed', v_machines_processed, 'machines_skipped', v_machines_skipped,
        'force_working_day', p_force_working_day,
        'message', 'คำนวณ OEE สำเร็จ: ' || v_machines_processed || ' เครื่อง'
                   || CASE WHEN p_force_working_day THEN ' (ยืนยันวันทำงาน)' ELSE '' END);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_recalc_oee_for_shift(UUID, BOOLEAN) TO authenticated, service_role;


-- 3) Helper RPC: ดึง std setup time สำหรับ UI hint
CREATE OR REPLACE FUNCTION public.rpc_get_std_setup_time(
    p_machine_id UUID,
    p_product_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT std_setup_time_seconds
           FROM public.production_standards
          WHERE machine_id = p_machine_id
            AND product_id = p_product_id
            AND is_active  = true
          LIMIT 1),
        0
    );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_std_setup_time(UUID, UUID) TO authenticated, service_role;
