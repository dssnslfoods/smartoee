-- ============================================================================
-- Auto-generate shift_calendar เมื่อ insert/update active shifts
-- ----------------------------------------------------------------------------
-- ปัญหา: การสร้าง shift_calendar พึ่ง edge function generate-shift-calendar
-- ที่ต้อง trigger ด้วยมือ → admin สร้าง shift ใหม่แล้วลืม trigger → operator ใช้งานไม่ได้
--
-- Fix: trigger บน shifts ที่ insert/update active shift → สร้าง shift_calendar
-- 14 วันข้างหน้า (ตาม working_days, ข้าม holiday)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_shifts_ensure_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_days_ahead INT := 14;
    v_d DATE;
    v_dow INT;
    v_is_holiday BOOLEAN;
    v_company_id UUID;
    v_today_bkk DATE;
BEGIN
    IF NEW.is_active = false THEN RETURN NEW; END IF;

    v_today_bkk := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;
    SELECT company_id INTO v_company_id FROM public.plants WHERE id = NEW.plant_id;

    FOR i IN 0..v_days_ahead - 1 LOOP
        v_d := GREATEST(v_today_bkk, NEW.effective_from) + i;
        v_dow := EXTRACT(ISODOW FROM v_d)::INT;
        IF NOT (v_dow = ANY (NEW.working_days)
                OR (v_dow = 7 AND 0 = ANY (NEW.working_days))) THEN
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.holidays h
             WHERE h.company_id = v_company_id
               AND (h.plant_id IS NULL OR h.plant_id = NEW.plant_id)
               AND (h.holiday_date = v_d
                    OR (h.is_recurring = true
                        AND EXTRACT(MONTH FROM h.holiday_date) = EXTRACT(MONTH FROM v_d)
                        AND EXTRACT(DAY   FROM h.holiday_date) = EXTRACT(DAY   FROM v_d)))
        ) INTO v_is_holiday;

        IF v_is_holiday THEN CONTINUE; END IF;

        INSERT INTO public.shift_calendar (plant_id, shift_id, shift_date, planned_time_minutes)
        VALUES (NEW.plant_id, NEW.id, v_d, NULL)
        ON CONFLICT (shift_id, shift_date, plant_id) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shifts_ensure_calendar ON public.shifts;
CREATE TRIGGER trg_shifts_ensure_calendar
    AFTER INSERT OR UPDATE OF is_active, working_days, effective_from, plant_id
    ON public.shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_shifts_ensure_calendar();
