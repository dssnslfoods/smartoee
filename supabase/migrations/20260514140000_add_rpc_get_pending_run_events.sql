-- RPC: คืน RUN events ที่ยังต้องบันทึกจำนวนผลิต
-- คำนวณ pending แบบครบเดียวที่ฝั่ง DB → ไม่ติด row limit ของ PostgREST
CREATE OR REPLACE FUNCTION public.rpc_get_pending_run_events(
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id                       UUID,
    machine_id               UUID,
    machine_name             TEXT,
    machine_code             TEXT,
    start_ts                 TIMESTAMPTZ,
    end_ts                   TIMESTAMPTZ,
    product_id               UUID,
    product_name             TEXT,
    product_code             TEXT,
    shift_calendar_id        UUID,
    shift_date               DATE,
    plant_id                 UUID,
    plant_name               TEXT,
    line_name                TEXT,
    created_by               UUID,
    staff_name               TEXT,
    ideal_cycle_time_seconds NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pe.id,
           m.id                    AS machine_id,
           m.name                  AS machine_name,
           m.code                  AS machine_code,
           pe.start_ts,
           pe.end_ts,
           pe.product_id,
           p.name                  AS product_name,
           p.code                  AS product_code,
           pe.shift_calendar_id,
           sc.shift_date,
           pl.id                   AS plant_id,
           pl.name                 AS plant_name,
           l.name                  AS line_name,
           pe.created_by,
           up.full_name            AS staff_name,
           m.ideal_cycle_time_seconds
      FROM public.production_events pe
      JOIN public.machines       m  ON m.id  = pe.machine_id
      JOIN public.lines          l  ON l.id  = m.line_id
      JOIN public.plants         pl ON pl.id = l.plant_id
      JOIN public.shift_calendar sc ON sc.id = pe.shift_calendar_id
      LEFT JOIN public.products      p  ON p.id  = pe.product_id
      LEFT JOIN public.user_profiles up ON up.user_id = pe.created_by
     WHERE pe.event_type = 'RUN'
       AND pe.end_ts IS NOT NULL
       AND pe.shift_calendar_id IS NOT NULL
       AND m.is_active = true
       AND (p_company_id IS NULL OR m.company_id = p_company_id)
       AND NOT EXISTS (
             SELECT 1 FROM public.production_counts pc
              WHERE pc.production_event_id = pe.id
           )
       AND NOT EXISTS (
             SELECT 1 FROM public.production_counts pc2
              WHERE pc2.machine_id        = pe.machine_id
                AND pc2.shift_calendar_id = pe.shift_calendar_id
           )
     ORDER BY pe.start_ts DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_pending_run_events(UUID) TO authenticated, service_role;

-- Helper เพิ่ม: นับเฉพาะตัวเลขสำหรับ badge (เร็วกว่าเรียก full RPC)
CREATE OR REPLACE FUNCTION public.rpc_count_pending_run_events(
    p_company_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INTEGER
      FROM public.production_events pe
      JOIN public.machines m ON m.id = pe.machine_id
     WHERE pe.event_type = 'RUN'
       AND pe.end_ts IS NOT NULL
       AND pe.shift_calendar_id IS NOT NULL
       AND m.is_active = true
       AND (p_company_id IS NULL OR m.company_id = p_company_id)
       AND NOT EXISTS (
             SELECT 1 FROM public.production_counts pc
              WHERE pc.production_event_id = pe.id
           )
       AND NOT EXISTS (
             SELECT 1 FROM public.production_counts pc2
              WHERE pc2.machine_id        = pe.machine_id
                AND pc2.shift_calendar_id = pe.shift_calendar_id
           );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_count_pending_run_events(UUID) TO authenticated, service_role;
