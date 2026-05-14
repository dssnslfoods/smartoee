-- =============================================================================
-- FIX: Link production_counts to RUN events automatically
-- -----------------------------------------------------------------------------
-- Problem:
--   rpc_add_counts (เรียกจาก Shopfloor/Monitor) บันทึก production_counts โดย
--   ไม่ใส่ production_event_id → หน้า PendingCounts และ badge ยังเห็น RUN event
--   นั้นเป็น "รอบันทึก" ตลอด แม้ supervisor จะใส่ตัวเลขแล้ว
--
-- Fix:
--   1. rpc_add_counts auto-link กับ RUN event ที่เปิดอยู่ (end_ts IS NULL)
--      ของเครื่องเดียวกันในกะนั้น ถ้าไม่มีตัวที่เปิด ใช้ตัวที่ปิดล่าสุด
--   2. Backfill: ลิงก์ production_counts เก่าที่ event_id เป็น NULL
--      จับคู่ด้วย machine_id + shift_calendar_id และ ts อยู่ในช่วง event
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Update rpc_add_counts: auto-link to active/recent RUN event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id        UUID,
    p_good_qty          INT,
    p_reject_qty        INT DEFAULT 0,
    p_defect_reason_id  UUID DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id          UUID;
    v_new_count_id      UUID;
    v_run_event_id      UUID;
BEGIN
    SELECT p.id INTO v_plant_id
      FROM public.machines m
      JOIN public.lines    l ON m.line_id = l.id
      JOIN public.plants   p ON l.plant_id = p.id
     WHERE m.id = p_machine_id;

    SELECT id INTO v_shift_calendar_id
      FROM public.shift_calendar
     WHERE plant_id = v_plant_id AND shift_date = CURRENT_DATE
     LIMIT 1;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.shift_approvals
         WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked.');
    END IF;

    -- หา RUN event ที่เปิดอยู่ก่อน (priority สูงสุด)
    SELECT id INTO v_run_event_id
      FROM public.production_events
     WHERE machine_id        = p_machine_id
       AND shift_calendar_id = v_shift_calendar_id
       AND event_type        = 'RUN'
       AND end_ts IS NULL
     ORDER BY start_ts DESC
     LIMIT 1;

    -- ถ้าไม่มี RUN ที่เปิดอยู่ → ใช้ RUN ที่ปิดล่าสุด
    IF v_run_event_id IS NULL THEN
        SELECT id INTO v_run_event_id
          FROM public.production_events
         WHERE machine_id        = p_machine_id
           AND shift_calendar_id = v_shift_calendar_id
           AND event_type        = 'RUN'
           AND end_ts IS NOT NULL
         ORDER BY end_ts DESC
         LIMIT 1;
    END IF;

    INSERT INTO public.production_counts (
        shift_calendar_id, machine_id, ts,
        good_qty, reject_qty, defect_reason_id, notes,
        created_by, production_event_id
    ) VALUES (
        v_shift_calendar_id, p_machine_id, NOW(),
        p_good_qty, p_reject_qty, p_defect_reason_id, p_notes,
        auth.uid(), v_run_event_id
    ) RETURNING id INTO v_new_count_id;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'count_id',  v_new_count_id,
            'total_qty', p_good_qty + p_reject_qty,
            'production_event_id', v_run_event_id
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_add_counts(UUID, INT, INT, UUID, TEXT) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 2) Backfill: ลิงก์ production_counts เก่าที่ยังไม่มี event_id
--    หลักเกณฑ์การจับคู่ (เลือกอย่างใดอย่างหนึ่ง โดยเรียงความแม่นยำ):
--      a) RUN event ที่ ts ของ count อยู่ระหว่าง start_ts..end_ts
--      b) ถ้าไม่มี → RUN event ในกะเดียวกัน เครื่องเดียวกัน end_ts <= count.ts ที่ใกล้ที่สุด
--      c) ถ้าไม่มี → RUN event ในกะเดียวกัน เครื่องเดียวกัน ที่ปิดล่าสุด
--
-- Note: ไม่ overwrite ของเดิมที่ event_id มีค่าอยู่แล้ว
-- ---------------------------------------------------------------------------
WITH candidate AS (
    SELECT pc.id AS count_id,
           (
               SELECT pe.id
                 FROM public.production_events pe
                WHERE pe.machine_id        = pc.machine_id
                  AND pe.shift_calendar_id = pc.shift_calendar_id
                  AND pe.event_type        = 'RUN'
                  AND pc.ts >= pe.start_ts
                  AND (pe.end_ts IS NULL OR pc.ts <= pe.end_ts)
                ORDER BY pe.start_ts DESC
                LIMIT 1
           ) AS event_id_in_range,
           (
               SELECT pe.id
                 FROM public.production_events pe
                WHERE pe.machine_id        = pc.machine_id
                  AND pe.shift_calendar_id = pc.shift_calendar_id
                  AND pe.event_type        = 'RUN'
                  AND pe.end_ts IS NOT NULL
                  AND pe.end_ts <= pc.ts
                ORDER BY pe.end_ts DESC
                LIMIT 1
           ) AS event_id_before,
           (
               SELECT pe.id
                 FROM public.production_events pe
                WHERE pe.machine_id        = pc.machine_id
                  AND pe.shift_calendar_id = pc.shift_calendar_id
                  AND pe.event_type        = 'RUN'
                ORDER BY COALESCE(pe.end_ts, pe.start_ts) DESC
                LIMIT 1
           ) AS event_id_any
      FROM public.production_counts pc
     WHERE pc.production_event_id IS NULL
       AND pc.shift_calendar_id IS NOT NULL
)
UPDATE public.production_counts pc
   SET production_event_id = COALESCE(c.event_id_in_range, c.event_id_before, c.event_id_any)
  FROM candidate c
 WHERE pc.id = c.count_id
   AND COALESCE(c.event_id_in_range, c.event_id_before, c.event_id_any) IS NOT NULL;
