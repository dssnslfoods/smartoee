-- =============================================
-- 6. MISSING TABLES AND INTERNAL FUNCTIONS
-- =============================================

-- =============================================
-- 6.1 CREATE MISSING TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, plant_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS public.planned_time_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    break_minutes INT NOT NULL DEFAULT 0,
    meal_minutes INT NOT NULL DEFAULT 0,
    meeting_minutes INT NOT NULL DEFAULT 0,
    maintenance_minutes INT NOT NULL DEFAULT 0,
    other_minutes INT NOT NULL DEFAULT 0,
    other_label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    break_start_time TIME WITHOUT TIME ZONE,
    break_end_time TIME WITHOUT TIME ZONE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(plant_id, shift_id)
);

-- RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_time_templates ENABLE ROW LEVEL SECURITY;

-- Policies for Holidays
DROP POLICY IF EXISTS "Admins full access to holidays" ON public.holidays;
CREATE POLICY "Admins full access to holidays" ON public.holidays FOR ALL TO public USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage holidays in their company" ON public.holidays;
CREATE POLICY "Supervisors can manage holidays in their company" ON public.holidays FOR ALL TO public USING (public.is_supervisor() AND company_id = public.get_user_company_id()) WITH CHECK (public.is_supervisor() AND company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view holidays in their company" ON public.holidays;
CREATE POLICY "Users can view holidays in their company" ON public.holidays FOR SELECT TO public USING ((company_id = public.get_user_company_id()) OR public.is_admin_or_manager());

-- Policies for Templates
DROP POLICY IF EXISTS "Admins full access to templates" ON public.planned_time_templates;
CREATE POLICY "Admins full access to templates" ON public.planned_time_templates FOR ALL TO public USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage templates in their company" ON public.planned_time_templates;
CREATE POLICY "Supervisors can manage templates in their company" ON public.planned_time_templates FOR ALL TO public USING (public.is_supervisor() AND company_id = public.get_user_company_id()) WITH CHECK (public.is_supervisor() AND company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view templates in their company" ON public.planned_time_templates;
CREATE POLICY "Users can view templates in their company" ON public.planned_time_templates FOR SELECT TO public USING ((company_id = public.get_user_company_id()) OR public.is_admin_or_manager());

-- =============================================
-- 6.2 SHIFT AUTO-CREATION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.ensure_shift_calendar(p_plant_id uuid, p_local_date date, p_local_time time without time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sc_id UUID;
  v_shift RECORD;
  v_shift_duration_minutes INTEGER;
  v_planned_time INTEGER;
  v_ppt_template RECORD;
  v_total_deductions INTEGER;
BEGIN
  -- 1) Try to find existing shift_calendar entry (same day)
  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = p_plant_id
     AND s.is_active = true
     AND sc.shift_date = p_local_date
     AND (EXTRACT(DOW FROM p_local_date))::int = ANY(s.working_days)
     AND (
       (s.start_time <= s.end_time AND p_local_time >= s.start_time AND p_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (p_local_time >= s.start_time OR p_local_time < s.end_time))
     )
   LIMIT 1;

  IF v_sc_id IS NOT NULL THEN
    RETURN v_sc_id;
  END IF;

  -- 2) Try previous day for overnight shifts
  SELECT sc.id INTO v_sc_id
    FROM shift_calendar sc
    JOIN shifts s ON s.id = sc.shift_id
   WHERE sc.plant_id = p_plant_id
     AND s.is_active = true
     AND sc.shift_date = (p_local_date - interval '1 day')::date
     AND (EXTRACT(DOW FROM (p_local_date - interval '1 day')::date))::int = ANY(s.working_days)
     AND s.start_time > s.end_time
     AND p_local_time < s.end_time
   LIMIT 1;

  IF v_sc_id IS NOT NULL THEN
    RETURN v_sc_id;
  END IF;

  -- 3) No shift_calendar found — try to auto-create from shifts table
  -- Check same-day shifts first
  SELECT s.* INTO v_shift
    FROM shifts s
   WHERE s.plant_id = p_plant_id
     AND s.is_active = true
     AND (EXTRACT(DOW FROM p_local_date))::int = ANY(s.working_days)
     AND s.effective_from <= p_local_date
     AND (
       (s.start_time <= s.end_time AND p_local_time >= s.start_time AND p_local_time < s.end_time)
       OR
       (s.start_time > s.end_time AND (p_local_time >= s.start_time OR p_local_time < s.end_time))
     )
   ORDER BY s.effective_from DESC
   LIMIT 1;

  -- Check previous-day overnight shifts
  IF v_shift IS NULL THEN
    SELECT s.* INTO v_shift
      FROM shifts s
     WHERE s.plant_id = p_plant_id
       AND s.is_active = true
       AND (EXTRACT(DOW FROM (p_local_date - interval '1 day')::date))::int = ANY(s.working_days)
       AND s.effective_from <= (p_local_date - interval '1 day')::date
       AND s.start_time > s.end_time
       AND p_local_time < s.end_time
     ORDER BY s.effective_from DESC
     LIMIT 1;

    IF v_shift IS NOT NULL THEN
      -- For overnight shift, the shift_date is previous day
      p_local_date := (p_local_date - interval '1 day')::date;
    END IF;
  END IF;

  IF v_shift IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check holidays before creating
  IF EXISTS (
    SELECT 1 FROM holidays h
    JOIN plants p ON p.id = p_plant_id
    WHERE h.company_id = p.company_id
      AND (h.plant_id IS NULL OR h.plant_id = p_plant_id)
      AND (
        h.holiday_date = p_local_date
        OR (h.is_recurring = true 
            AND EXTRACT(MONTH FROM h.holiday_date) = EXTRACT(MONTH FROM p_local_date) 
            AND EXTRACT(DAY FROM h.holiday_date) = EXTRACT(DAY FROM p_local_date))
      )
  ) THEN
    RETURN NULL;
  END IF;

  -- Calculate planned_time from PPT template
  v_shift_duration_minutes := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time))::int / 60;
  IF v_shift_duration_minutes <= 0 THEN
    v_shift_duration_minutes := v_shift_duration_minutes + 1440;
  END IF;

  SELECT * INTO v_ppt_template
    FROM planned_time_templates
   WHERE plant_id = p_plant_id
     AND shift_id = v_shift.id
     AND is_active = true
     AND effective_from <= p_local_date
   ORDER BY effective_from DESC
   LIMIT 1;

  IF v_ppt_template IS NOT NULL THEN
    v_total_deductions := COALESCE(v_ppt_template.break_minutes, 0)
                        + COALESCE(v_ppt_template.meal_minutes, 0)
                        + COALESCE(v_ppt_template.meeting_minutes, 0)
                        + COALESCE(v_ppt_template.maintenance_minutes, 0)
                        + COALESCE(v_ppt_template.other_minutes, 0);
    v_planned_time := GREATEST(v_shift_duration_minutes - v_total_deductions, 0);
  ELSE
    v_planned_time := v_shift_duration_minutes;
  END IF;

  -- Auto-create shift_calendar entry
  INSERT INTO shift_calendar (plant_id, shift_id, shift_date, planned_time_minutes)
  VALUES (p_plant_id, v_shift.id, p_local_date, v_planned_time)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_sc_id;

  -- If ON CONFLICT hit, fetch existing
  IF v_sc_id IS NULL THEN
    SELECT sc.id INTO v_sc_id
      FROM shift_calendar sc
     WHERE sc.plant_id = p_plant_id
       AND sc.shift_id = v_shift.id
       AND sc.shift_date = p_local_date
     LIMIT 1;
     
    IF v_sc_id IS NULL THEN
      RAISE EXCEPTION 'DEBUG_INSERT_FAILED: Conflict but could not fetch existing row for plant=%, shift_id=%, date=%', p_plant_id, v_shift.id, p_local_date;
    END IF;
  END IF;

  RETURN v_sc_id;
END;
$function$;

-- =============================================
-- 6.3 UPDATE API RPCS TO AUTO-CREATE
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_start_event(
    p_machine_id UUID,
    p_event_type public.event_type,
    p_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id UUID;
    v_line_id UUID;
    v_new_event_id UUID;
    v_local_ts TIMESTAMP;
BEGIN
    SELECT p.id, m.line_id INTO v_plant_id, v_line_id
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    JOIN public.plants p ON l.plant_id = p.id
    WHERE m.id = p_machine_id;

    IF v_plant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Machine not found');
    END IF;

    -- Get current time in local timezone (Thailand)
    v_local_ts := timezone('Asia/Bangkok', now());

    -- Call ensure_shift_calendar to automatically find OR provision the active shift today!
    v_shift_calendar_id := public.ensure_shift_calendar(v_plant_id, v_local_ts::date, v_local_ts::time);

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found for today. Please create one.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked. Cannot start event.');
    END IF;

    UPDATE public.production_events
    SET end_ts = NOW(), updated_at = NOW()
    WHERE machine_id = p_machine_id AND end_ts IS NULL;

    INSERT INTO public.production_events (
        plant_id, line_id, machine_id, shift_calendar_id, 
        event_type, reason_id, product_id, start_ts, notes, created_by
    ) VALUES (
        v_plant_id, v_line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, p_product_id, NOW(), p_notes, auth.uid()
    ) RETURNING id INTO v_new_event_id;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('event_id', v_new_event_id));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.rpc_add_counts(
    p_machine_id UUID,
    p_good_qty INT,
    p_reject_qty INT DEFAULT 0,
    p_defect_reason_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift_calendar_id UUID;
    v_plant_id UUID;
    v_new_count_id UUID;
    v_local_ts TIMESTAMP;
BEGIN
    SELECT p.id INTO v_plant_id
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    JOIN public.plants p ON l.plant_id = p.id
    WHERE m.id = p_machine_id;

    -- Get current time in local timezone (Thailand)
    v_local_ts := timezone('Asia/Bangkok', now());

    -- Call ensure_shift_calendar to automatically find OR provision the active shift today!
    v_shift_calendar_id := public.ensure_shift_calendar(v_plant_id, v_local_ts::date, v_local_ts::time);

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No active shift calendar found.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.shift_approvals WHERE shift_calendar_id = v_shift_calendar_id AND status = 'LOCKED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Current shift is locked.');
    END IF;

    INSERT INTO public.production_counts (
        shift_calendar_id, machine_id, ts, good_qty, reject_qty, defect_reason_id, notes, created_by
    ) VALUES (
        v_shift_calendar_id, p_machine_id, NOW(), p_good_qty, p_reject_qty, p_defect_reason_id, p_notes, auth.uid()
    ) RETURNING id INTO v_new_count_id;

    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('count_id', v_new_count_id, 'total_qty', p_good_qty + p_reject_qty));
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'SERVER_ERROR', 'message', SQLERRM);
END;
$$;
