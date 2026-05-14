-- ============================================================================
-- Fix Template Edit Cascade + Auto Recalc
-- ----------------------------------------------------------------------------
-- Bug 1: เมื่อ update planned_time_templates → shift_calendar อัปเดต แต่
--        oee_snapshots ยังคงเป็นค่าเก่า — ไม่ recalc อัตโนมัติ
-- Bug 2: ตอน admin toggle active off → cascade ไม่ลบ deduction ออก เพราะ
--        trigger บน shift_calendar กรองเฉพาะ 480/NULL — ค่าอื่นถูกล็อก
--
-- Fix:
--  - เพิ่ม trigger AFTER UPDATE OF planned_time_minutes บน shift_calendar
--    → calculate_oee อัตโนมัติ (ยกเว้น LOCKED)
--  - เพิ่ม column planned_time_manual_override สำหรับ admin ที่ตั้งค่า manual
--  - rewrite trg_shift_calendar_set_planned_time ให้ใช้ flag แทนเดา 480
--  - rewrite trg_ppt_cascade_to_shift_calendar ให้เคารพ flag
--  - เพิ่ม trigger AFTER DELETE on planned_time_templates สำหรับ hard delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_shift_calendar_recalc_oee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.planned_time_minutes IS DISTINCT FROM OLD.planned_time_minutes
       AND NOT EXISTS (
           SELECT 1 FROM public.shift_approvals sa
            WHERE sa.shift_calendar_id = NEW.id AND sa.status = 'LOCKED'
       )
    THEN
        BEGIN
            PERFORM public.calculate_oee(NEW.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'calculate_oee failed for shift % : %', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_calendar_recalc_oee ON public.shift_calendar;
CREATE TRIGGER trg_shift_calendar_recalc_oee
    AFTER UPDATE OF planned_time_minutes ON public.shift_calendar
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_shift_calendar_recalc_oee();


-- planned_time_manual_override: admin ตั้ง planned_time ด้วยมือ → trigger จะไม่ overwrite
ALTER TABLE public.shift_calendar
    ADD COLUMN IF NOT EXISTS planned_time_manual_override BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.shift_calendar.planned_time_manual_override IS
    'true = ตั้งค่า planned_time_minutes ด้วยมือ ไม่ให้ trigger cascade overwrite';


CREATE OR REPLACE FUNCTION public.tg_shift_calendar_set_planned_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_net INTEGER;
BEGIN
    IF NEW.planned_time_manual_override THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT'
       OR NEW.planned_time_minutes IS NULL
       OR NEW.planned_time_minutes = 480
       OR NEW.shift_id   IS DISTINCT FROM OLD.shift_id
       OR NEW.shift_date IS DISTINCT FROM OLD.shift_date
       OR NEW.plant_id   IS DISTINCT FROM OLD.plant_id
    THEN
        v_net := public.compute_net_planned_time(NEW.plant_id, NEW.shift_id, NEW.shift_date);
        NEW.planned_time_minutes := v_net;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_ppt_cascade_to_shift_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.shift_calendar sc
       SET planned_time_minutes = public.compute_net_planned_time(sc.plant_id, sc.shift_id, sc.shift_date)
     WHERE sc.shift_id   = NEW.shift_id
       AND sc.plant_id   = NEW.plant_id
       AND sc.shift_date >= NEW.effective_from
       AND sc.planned_time_manual_override = false
       AND NOT EXISTS (
           SELECT 1 FROM public.shift_approvals sa
            WHERE sa.shift_calendar_id = sc.id AND sa.status = 'LOCKED'
       );
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_ppt_delete_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.shift_calendar sc
       SET planned_time_minutes = public.compute_net_planned_time(sc.plant_id, sc.shift_id, sc.shift_date)
     WHERE sc.shift_id   = OLD.shift_id
       AND sc.plant_id   = OLD.plant_id
       AND sc.shift_date >= OLD.effective_from
       AND sc.planned_time_manual_override = false
       AND NOT EXISTS (
           SELECT 1 FROM public.shift_approvals sa
            WHERE sa.shift_calendar_id = sc.id AND sa.status = 'LOCKED'
       );
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppt_delete_cascade ON public.planned_time_templates;
CREATE TRIGGER trg_ppt_delete_cascade
    AFTER DELETE ON public.planned_time_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_ppt_delete_cascade();
