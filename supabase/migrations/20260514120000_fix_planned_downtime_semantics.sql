-- =============================================================================
-- FIX: Planned Downtime Semantics
-- -----------------------------------------------------------------------------
-- Problem (ก่อนแก้):
--   • shift_calendar.planned_time_minutes ใช้ default 480 ตอนสร้างใหม่ ทำให้
--     ช่วงพัก (break/meal/meeting/maintenance/other) ไม่ได้ถูกหักออก
--   • Operator หยุดเครื่องช่วงพัก → RUN event ไม่ครอบช่วงพัก → run_time ลดลง
--     แต่ planned_time ยังเป็น 480 → Availability ดูแย่กว่าจริง
--   • DOWNTIME ที่มี reason category = 'PLANNED' (เช่น Changeover, Cleaning)
--     ถูกนับเป็น availability loss ทั้งที่ควรถือเป็น planned non-production
--
-- Fix:
--   1. helper compute_net_planned_time(): คำนวณ net planned time จาก shift
--      duration หักด้วย planned_time_templates
--   2. trigger BEFORE INSERT/UPDATE บน shift_calendar: ตั้ง planned_time_minutes
--      อัตโนมัติ (ถ้าไม่ได้ระบุค่าเอง)
--   3. trigger AFTER INSERT/UPDATE บน planned_time_templates: cascade ไปอัปเดต
--      shift_calendar ของวันที่อนาคต (>= today) — เก็บประวัติเดิมไว้
--   4. แก้ calculate_oee และ rpc_recalc_oee_for_shift:
--        - หัก PLANNED downtime ออกจาก planned_time (treat as additional
--          planned non-production)
--        - downtime สำหรับ availability calc = เฉพาะ UNPLANNED/PERFORMANCE_LOSS
--          และ DOWNTIME ที่ไม่มี reason กำกับ (สันนิษฐานว่าเป็น unplanned)
--   5. backfill: shift_calendar ของวันที่ >= วันนี้ ให้ recompute
--   6. recalc: oee_snapshots ของ shift ที่ยังไม่ LOCKED จะถูก trigger ใหม่
--
-- Reversibility: drop functions/triggers ใน rollback section ด้านล่างหาก
-- ต้องการย้อนกลับ
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Helper: compute net planned time for a given plant+shift+date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_net_planned_time(
    p_plant_id  UUID,
    p_shift_id  UUID,
    p_date      DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start         TIME;
    v_end           TIME;
    v_shift_minutes INTEGER;
    v_tpl           RECORD;
    v_deductions    INTEGER := 0;
BEGIN
    SELECT start_time, end_time
      INTO v_start, v_end
      FROM public.shifts
     WHERE id = p_shift_id;

    IF v_start IS NULL THEN
        RETURN 480;  -- fallback ถ้าหา shift ไม่เจอ
    END IF;

    v_shift_minutes := EXTRACT(EPOCH FROM (v_end - v_start))::INT / 60;
    IF v_shift_minutes <= 0 THEN
        v_shift_minutes := v_shift_minutes + 1440;  -- overnight shift
    END IF;

    SELECT *
      INTO v_tpl
      FROM public.planned_time_templates
     WHERE plant_id      = p_plant_id
       AND shift_id      = p_shift_id
       AND is_active     = true
       AND effective_from <= p_date
     ORDER BY effective_from DESC
     LIMIT 1;

    IF FOUND THEN
        v_deductions := COALESCE(v_tpl.break_minutes,       0)
                      + COALESCE(v_tpl.meal_minutes,        0)
                      + COALESCE(v_tpl.meeting_minutes,     0)
                      + COALESCE(v_tpl.maintenance_minutes, 0)
                      + COALESCE(v_tpl.other_minutes,       0);
    END IF;

    RETURN GREATEST(v_shift_minutes - v_deductions, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_net_planned_time(UUID, UUID, DATE)
    TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2) Trigger: auto-fill shift_calendar.planned_time_minutes
--    ทำงานเมื่อ insert/update และค่าที่ใส่มาเป็น default 480 หรือ NULL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_shift_calendar_set_planned_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_net INTEGER;
BEGIN
    -- เคารพค่าที่ผู้ใช้กำหนดเองโดยเจตนา (ไม่ใช่ 480 default)
    -- ถ้าเป็น 480 (default) หรือ NULL → คำนวณใหม่จาก template
    IF NEW.planned_time_minutes IS NULL OR NEW.planned_time_minutes = 480 THEN
        v_net := public.compute_net_planned_time(NEW.plant_id, NEW.shift_id, NEW.shift_date);
        NEW.planned_time_minutes := v_net;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_calendar_set_planned_time ON public.shift_calendar;
CREATE TRIGGER trg_shift_calendar_set_planned_time
    BEFORE INSERT OR UPDATE OF shift_id, shift_date, plant_id
    ON public.shift_calendar
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_shift_calendar_set_planned_time();


-- ---------------------------------------------------------------------------
-- 3) Trigger: เมื่อแก้ planned_time_templates → cascade ไปยัง shift_calendar
--    เฉพาะ shift_date >= effective_from และยังไม่ LOCKED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_ppt_cascade_to_shift_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.shift_calendar sc
       SET planned_time_minutes = public.compute_net_planned_time(sc.plant_id, sc.shift_id, sc.shift_date)
      FROM public.shifts s
     WHERE sc.shift_id  = NEW.shift_id
       AND sc.plant_id  = NEW.plant_id
       AND sc.shift_id  = s.id
       AND sc.shift_date >= NEW.effective_from
       AND NOT EXISTS (
           SELECT 1
             FROM public.shift_approvals sa
            WHERE sa.shift_calendar_id = sc.id
              AND sa.status = 'LOCKED'
       );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppt_cascade ON public.planned_time_templates;
CREATE TRIGGER trg_ppt_cascade
    AFTER INSERT OR UPDATE
    ON public.planned_time_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_ppt_cascade_to_shift_calendar();


-- ---------------------------------------------------------------------------
-- 4a) Update legacy calculate_oee — ใช้ template + แยก planned/unplanned downtime
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_oee(p_shift_calendar_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_planned_time      INT;
    v_planned_downtime  INT;
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
    SELECT sc.planned_time_minutes,
           sc.shift_date,
           s.start_time,
           s.end_time
      INTO v_shift
      FROM public.shift_calendar sc
      JOIN public.shifts s ON s.id = sc.shift_id
     WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN
        RETURN;
    END IF;

    v_planned_time := v_shift.planned_time_minutes;
    v_shift_start  := (v_shift.shift_date || ' ' || v_shift.start_time)::TIMESTAMPTZ;
    v_shift_end    := (v_shift.shift_date || ' ' || v_shift.end_time)::TIMESTAMPTZ;
    IF v_shift_end <= v_shift_start THEN
        v_shift_end := v_shift_end + interval '1 day';
    END IF;

    FOR machine_record IN
        SELECT DISTINCT machine_id FROM public.production_counts WHERE shift_calendar_id = p_shift_calendar_id
        UNION
        SELECT DISTINCT machine_id FROM public.production_events WHERE shift_calendar_id = p_shift_calendar_id
    LOOP
        -- Run time จาก RUN events
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts))/60), 0)::INT
          INTO v_run_time
          FROM public.production_events
         WHERE shift_calendar_id = p_shift_calendar_id
           AND machine_id        = machine_record.machine_id
           AND event_type        = 'RUN';

        -- Planned downtime (changeover, cleaning ฯลฯ) — แยกจาก availability loss
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60), 0)::INT
          INTO v_planned_downtime
          FROM public.production_events pe
          JOIN public.downtime_reasons  dr ON dr.id = pe.reason_id
         WHERE pe.shift_calendar_id = p_shift_calendar_id
           AND pe.machine_id        = machine_record.machine_id
           AND pe.event_type        = 'DOWNTIME'
           AND dr.category          = 'PLANNED';

        -- Unplanned/performance-loss downtime = real availability loss
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))/60), 0)::INT
          INTO v_unplanned_dt
          FROM public.production_events pe
          LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
         WHERE pe.shift_calendar_id = p_shift_calendar_id
           AND pe.machine_id        = machine_record.machine_id
           AND pe.event_type        = 'DOWNTIME'
           AND (dr.category IS NULL OR dr.category IN ('UNPLANNED', 'PERFORMANCE_LOSS'));

        -- หัก planned downtime ออกจาก planned time → ได้เวลาที่ "ควรผลิตได้จริง"
        v_adj_planned_time := GREATEST(v_planned_time - v_planned_downtime, 0);

        -- Counts
        SELECT COALESCE(SUM(good_qty), 0), COALESCE(SUM(reject_qty), 0)
          INTO v_good_qty, v_reject_qty
          FROM public.production_counts
         WHERE shift_calendar_id = p_shift_calendar_id
           AND machine_id        = machine_record.machine_id;

        SELECT ideal_cycle_time_seconds INTO v_ideal_cycle_time
          FROM public.machines WHERE id = machine_record.machine_id;

        -- Availability = run_time / (planned_time - planned_downtime)
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


-- ---------------------------------------------------------------------------
-- 4b) Update rpc_recalc_oee_for_shift — แยก planned/unplanned downtime
--     (โครงเดิมจาก migration 20260302113000 + การหัก planned downtime)
-- ---------------------------------------------------------------------------
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
    v_planned_downtime     INTEGER;
    v_unplanned_dt         INTEGER;
    v_setup_time           INTEGER;
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

    -- Holiday check
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

    -- Net planned time จาก template (หรือ fallback เป็น shift_calendar.planned_time_minutes)
    v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time))::INT / 60;
    IF v_shift_duration_minutes <= 0 THEN
        v_shift_duration_minutes := v_shift_duration_minutes + 1440;
    END IF;

    SELECT *
      INTO v_ppt_template
      FROM public.planned_time_templates
     WHERE plant_id       = v_shift.plant_id
       AND shift_id       = v_shift.shift_id
       AND is_active      = true
       AND effective_from <= v_shift.shift_date
     ORDER BY effective_from DESC
     LIMIT 1;

    IF FOUND THEN
        v_total_deductions := COALESCE(v_ppt_template.break_minutes,       0)
                            + COALESCE(v_ppt_template.meal_minutes,        0)
                            + COALESCE(v_ppt_template.meeting_minutes,     0)
                            + COALESCE(v_ppt_template.maintenance_minutes, 0)
                            + COALESCE(v_ppt_template.other_minutes,       0);
        v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
    ELSE
        v_planned_time := v_shift.planned_time_minutes;
    END IF;

    FOR v_machine IN
        SELECT m.*
          FROM public.machines m
          JOIN public.lines    l ON m.line_id = l.id
         WHERE l.plant_id = v_shift.plant_id
           AND m.is_active = true
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
                ) VALUES (
                    'MACHINE', v_machine.id, 'SHIFT',
                    (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
                    (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
                    p_shift_calendar_id,
                    0, 0, 0, 0,
                    0, 0, v_planned_time,
                    0, 0
                );
                v_machines_processed := v_machines_processed + 1;
            ELSE
                DELETE FROM public.oee_snapshots
                 WHERE scope = 'MACHINE' AND scope_id = v_machine.id
                   AND period = 'SHIFT' AND shift_calendar_id = p_shift_calendar_id;
                v_machines_skipped := v_machines_skipped + 1;
            END IF;
            CONTINUE;
        END IF;

        -- Ideal cycle time (weighted by run event duration × product standard)
        SELECT COALESCE(
                   SUM(COALESCE(ps.ideal_cycle_time_seconds, v_machine.ideal_cycle_time_seconds)
                       * EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)))
                 / NULLIF(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))), 0),
                   v_machine.ideal_cycle_time_seconds)
          INTO v_ideal_cycle_time
          FROM public.production_events pe
          LEFT JOIN public.production_standards ps
                 ON ps.machine_id = v_machine.id
                AND ps.product_id = pe.product_id
                AND ps.is_active  = true
         WHERE pe.machine_id        = v_machine.id
           AND pe.shift_calendar_id = p_shift_calendar_id
           AND pe.event_type        = 'RUN';

        IF v_ideal_cycle_time IS NULL OR v_ideal_cycle_time <= 0 THEN
            v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;
        END IF;

        -- Run time
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60), 0)::INTEGER
          INTO v_run_time
          FROM public.production_events
         WHERE machine_id = v_machine.id
           AND shift_calendar_id = p_shift_calendar_id
           AND event_type = 'RUN';

        -- Planned downtime: DOWNTIME with reason.category = 'PLANNED' (changeover, cleaning)
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60), 0)::INTEGER
          INTO v_planned_downtime
          FROM public.production_events pe
          JOIN public.downtime_reasons  dr ON dr.id = pe.reason_id
         WHERE pe.machine_id        = v_machine.id
           AND pe.shift_calendar_id = p_shift_calendar_id
           AND pe.event_type        = 'DOWNTIME'
           AND dr.category          = 'PLANNED';

        -- Unplanned/performance-loss downtime = ตัวจริงที่กระทบ Availability
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60), 0)::INTEGER
          INTO v_unplanned_dt
          FROM public.production_events pe
          LEFT JOIN public.downtime_reasons dr ON dr.id = pe.reason_id
         WHERE pe.machine_id        = v_machine.id
           AND pe.shift_calendar_id = p_shift_calendar_id
           AND pe.event_type        = 'DOWNTIME'
           AND (dr.category IS NULL OR dr.category IN ('UNPLANNED', 'PERFORMANCE_LOSS'));

        -- SETUP events นับเป็น changeover (planned) → ไปอยู่ใน planned_downtime
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60), 0)::INTEGER
          INTO v_setup_time
          FROM public.production_events
         WHERE machine_id = v_machine.id
           AND shift_calendar_id = p_shift_calendar_id
           AND event_type = 'SETUP';

        v_planned_downtime := v_planned_downtime + v_setup_time;

        -- เวลาที่ "ควรผลิตได้จริง" = planned - planned_downtime
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
        ) VALUES (
            'MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::timestamptz,
            (v_shift.shift_date || ' ' || v_shift.end_time)::timestamptz,
            p_shift_calendar_id,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_unplanned_dt, v_adj_planned_time,
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
        'message', 'คำนวณ OEE สำเร็จ: ' || v_machines_processed || ' เครื่อง'
                   || CASE WHEN p_force_working_day THEN ' (ยืนยันวันทำงาน)' ELSE '' END
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_recalc_oee_for_shift(UUID, BOOLEAN) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 5) Backfill: shift_calendar ของวันที่ >= วันนี้ (ที่ยังไม่ LOCKED)
--    ให้ recompute planned_time_minutes จาก template
-- ---------------------------------------------------------------------------
UPDATE public.shift_calendar sc
   SET planned_time_minutes = public.compute_net_planned_time(sc.plant_id, sc.shift_id, sc.shift_date)
 WHERE sc.shift_date >= CURRENT_DATE
   AND NOT EXISTS (
       SELECT 1 FROM public.shift_approvals sa
        WHERE sa.shift_calendar_id = sc.id AND sa.status = 'LOCKED'
   );


-- ---------------------------------------------------------------------------
-- 6) Recalc snapshots ของ shift ที่ shift_date >= วันนี้ และยังไม่ LOCKED
--    เรียก calculate_oee เพื่อ refresh ตัวเลขให้ตรงกับ logic ใหม่
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT sc.id
          FROM public.shift_calendar sc
         WHERE sc.shift_date >= CURRENT_DATE
           AND NOT EXISTS (
               SELECT 1 FROM public.shift_approvals sa
                WHERE sa.shift_calendar_id = sc.id AND sa.status = 'LOCKED'
           )
    LOOP
        PERFORM public.calculate_oee(r.id);
    END LOOP;
END $$;


-- =============================================================================
-- ROLLBACK (สำหรับ reference — รันด้วยมือถ้าต้องการย้อน)
-- -----------------------------------------------------------------------------
-- DROP TRIGGER  IF EXISTS trg_ppt_cascade ON public.planned_time_templates;
-- DROP TRIGGER  IF EXISTS trg_shift_calendar_set_planned_time ON public.shift_calendar;
-- DROP FUNCTION IF EXISTS public.tg_ppt_cascade_to_shift_calendar();
-- DROP FUNCTION IF EXISTS public.tg_shift_calendar_set_planned_time();
-- DROP FUNCTION IF EXISTS public.compute_net_planned_time(UUID, UUID, DATE);
-- จากนั้น restore calculate_oee และ rpc_recalc_oee_for_shift จาก migration ก่อนหน้า
-- =============================================================================
