-- ============================================================================
-- Audit Logs Retention: เก็บใน active table เฉพาะ 3 เดือนล่าสุด
-- ของเก่ากว่านั้นย้ายไป audit_logs_archive (ไม่ลบทันที เผื่อต้องการย้อนดู)
--
-- ความปลอดภัย: audit_logs ไม่ได้ถูกใช้ในการคำนวณ OEE หรือ analytics ใดๆ
-- จึงสามารถ archive ได้โดยไม่กระทบสถิติ
-- ============================================================================

-- 1) สร้างตาราง archive (โครงสร้างเหมือนเดิม + ติดดัชนีเดียวกัน)
CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
    id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type    text NOT NULL,
    entity_id      uuid NOT NULL,
    action         text NOT NULL,
    before_json    jsonb,
    after_json     jsonb,
    actor_user_id  uuid,
    ts             timestamp with time zone NOT NULL,
    archived_at    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_ts          ON public.audit_logs_archive(ts);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_entity      ON public.audit_logs_archive(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_actor       ON public.audit_logs_archive(actor_user_id);

-- RLS เดียวกับตารางหลัก: เฉพาะ admin/manager อ่านได้
ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view archived audit logs" ON public.audit_logs_archive;
CREATE POLICY "Admins can view archived audit logs"
    ON public.audit_logs_archive FOR SELECT TO authenticated
    USING (public.is_admin_or_manager());


-- 2) Archive function — ย้ายของเก่ากว่า p_months เดือนไป archive
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(p_months INT DEFAULT 3)
RETURNS TABLE (archived_count INT, oldest_remaining TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff   TIMESTAMPTZ;
    v_count    INT;
    v_oldest   TIMESTAMPTZ;
BEGIN
    v_cutoff := NOW() - (p_months || ' months')::INTERVAL;

    WITH moved AS (
        DELETE FROM public.audit_logs
         WHERE ts < v_cutoff
        RETURNING id, entity_type, entity_id, action, before_json, after_json, actor_user_id, ts
    )
    INSERT INTO public.audit_logs_archive (
        id, entity_type, entity_id, action, before_json, after_json, actor_user_id, ts
    )
    SELECT id, entity_type, entity_id, action, before_json, after_json, actor_user_id, ts
      FROM moved;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    SELECT MIN(ts) INTO v_oldest FROM public.audit_logs;

    RETURN QUERY SELECT v_count, v_oldest;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_old_audit_logs(INT) TO service_role;


-- 3) Helper: ลบ archive เก่ากว่า X เดือน (ถ้าไม่ต้องการเก็บ archive ก็เรียกได้)
CREATE OR REPLACE FUNCTION public.purge_audit_logs_archive(p_months INT DEFAULT 24)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM public.audit_logs_archive
     WHERE ts < NOW() - (p_months || ' months')::INTERVAL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_audit_logs_archive(INT) TO service_role;


-- 4) View รวม: สำหรับ admin อยากดู audit ครบทุกช่วง (active + archive)
CREATE OR REPLACE VIEW public.v_audit_logs_all AS
    SELECT id, entity_type, entity_id, action, before_json, after_json, actor_user_id, ts,
           'active'::text AS source
      FROM public.audit_logs
    UNION ALL
    SELECT id, entity_type, entity_id, action, before_json, after_json, actor_user_id, ts,
           'archive'::text AS source
      FROM public.audit_logs_archive;

GRANT SELECT ON public.v_audit_logs_all TO authenticated;


-- 5) ตั้ง pg_cron: รัน archive_old_audit_logs(3) ทุกวันที่ 28-31 เวลา 19:00 UTC (= 02:00 Bangkok)
--    function เป็น idempotent (ถ้าไม่มี row เก่า ก็ไม่ทำอะไร) จึงรันซ้ำได้ปลอดภัย
DO $$
BEGIN
    PERFORM cron.unschedule('audit_logs_monthly_archive');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'audit_logs_monthly_archive',
    '0 19 28-31 * *',
    $$ SELECT public.archive_old_audit_logs(3); $$
);
