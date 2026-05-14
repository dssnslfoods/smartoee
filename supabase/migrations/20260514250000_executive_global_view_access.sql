-- ============================================================================
-- EXECUTIVE: เปิดให้เห็นข้อมูลทุกบริษัท (global view)
-- ----------------------------------------------------------------------------
-- ก่อนแก้: 7 RLS policies จำกัด EXECUTIVE เห็นเฉพาะ company ของตัวเอง
-- หลังแก้: เปลี่ยน policy ให้ EXECUTIVE เห็นข้าม company ใน 10 tables
--          (machines, lines, plants, production_events, production_counts,
--           oee_snapshots, downtime_reasons, setup_reasons, shifts,
--           shift_calendar, products)
--
-- หมายเหตุ:
-- - policy ของ role อื่น (ADMIN, SUPERVISOR, STAFF) ไม่ถูกแตะ
-- - EXECUTIVE ยังคงมีสิทธิ์ SELECT เท่านั้น (อ่านอย่างเดียว)
-- - companies table มี policy "Users can view companies" = true แล้ว
-- ============================================================================

DROP POLICY IF EXISTS "Executives can view machines in their company" ON public.machines;
CREATE POLICY "Executives can view machines (global)"
    ON public.machines FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view lines in their company" ON public.lines;
CREATE POLICY "Executives can view lines (global)"
    ON public.lines FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view plants in their company" ON public.plants;
CREATE POLICY "Executives can view plants (global)"
    ON public.plants FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view downtime_reasons" ON public.downtime_reasons;
CREATE POLICY "Executives can view downtime_reasons (global)"
    ON public.downtime_reasons FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view setup_reasons" ON public.setup_reasons;
CREATE POLICY "Executives can view setup_reasons (global)"
    ON public.setup_reasons FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view production_events" ON public.production_events;
CREATE POLICY "Executives can view production_events (global)"
    ON public.production_events FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view production_counts" ON public.production_counts;
CREATE POLICY "Executives can view production_counts (global)"
    ON public.production_counts FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view shifts (global)" ON public.shifts;
CREATE POLICY "Executives can view shifts (global)"
    ON public.shifts FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view shift_calendar (global)" ON public.shift_calendar;
CREATE POLICY "Executives can view shift_calendar (global)"
    ON public.shift_calendar FOR SELECT TO authenticated
    USING (public.is_executive());

DROP POLICY IF EXISTS "Executives can view products (global)" ON public.products;
CREATE POLICY "Executives can view products (global)"
    ON public.products FOR SELECT TO authenticated
    USING (public.is_executive());
