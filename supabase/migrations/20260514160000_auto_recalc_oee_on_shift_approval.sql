-- ============================================================================
-- Auto-recalc OEE when shift_approvals transitions to APPROVED or LOCKED
-- ----------------------------------------------------------------------------
-- Problem:
--   Supervisor บางครั้ง lock shift โดยที่ระบบยังไม่ได้คำนวณ OEE ทำให้
--   oee_snapshots ไม่มี row สำหรับ shift นั้น (สถิติหาย)
--   พบ 3 เคสจริง: SM-014 (12 พ.ค.), SM-007 (4 พ.ค.), SM-014 (4 พ.ค.)
--
-- Fix:
--   1. Trigger บน shift_approvals: เมื่อ status เปลี่ยนเป็น APPROVED หรือ LOCKED
--      → เรียก calculate_oee อัตโนมัติ
--   2. Backfill: รัน calculate_oee สำหรับทุก shift_calendar ที่มี events
--      แต่ยังไม่มี oee_snapshots
-- ============================================================================

-- 1) Trigger function
CREATE OR REPLACE FUNCTION public.tg_recalc_oee_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IN ('APPROVED', 'LOCKED')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        -- ใช้ PERFORM เพราะ calculate_oee คืน void
        -- ครอบ EXCEPTION เพื่อไม่ block การ approve หาก calc fail
        BEGIN
            PERFORM public.calculate_oee(NEW.shift_calendar_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'calculate_oee failed for shift % : %', NEW.shift_calendar_id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_oee_on_approve ON public.shift_approvals;
CREATE TRIGGER trg_recalc_oee_on_approve
    AFTER INSERT OR UPDATE OF status ON public.shift_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_recalc_oee_on_approve();


-- 2) Backfill: ทุก shift_calendar ที่มี events แต่ยังไม่มี OEE snapshot
DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT sc.id AS shift_calendar_id
          FROM shift_calendar sc
         WHERE EXISTS (
             SELECT 1 FROM production_events pe
              WHERE pe.shift_calendar_id = sc.id
         )
           AND NOT EXISTS (
             SELECT 1 FROM oee_snapshots os
              WHERE os.shift_calendar_id = sc.id
                AND os.scope = 'MACHINE'
           )
    LOOP
        BEGIN
            PERFORM public.calculate_oee(r.shift_calendar_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Backfill calc failed for shift % : %', r.shift_calendar_id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Backfilled OEE for % shift(s)', v_count;
END $$;
