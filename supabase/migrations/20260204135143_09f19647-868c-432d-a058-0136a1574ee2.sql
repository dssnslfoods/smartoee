-- =============================================
-- TRANSACTION TABLES + RLS + VIEWS
-- =============================================

-- 1. PRODUCTION EVENTS TABLE
CREATE TABLE public.production_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE NOT NULL,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) ON DELETE CASCADE NOT NULL,
    event_type public.event_type NOT NULL,
    reason_id UUID REFERENCES public.downtime_reasons(id),
    start_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_ts TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PRODUCTION COUNTS TABLE
CREATE TABLE public.production_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) ON DELETE CASCADE NOT NULL,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    good_qty INTEGER NOT NULL DEFAULT 0,
    reject_qty INTEGER NOT NULL DEFAULT 0,
    defect_reason_id UUID REFERENCES public.defect_reasons(id),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SHIFT APPROVALS TABLE
CREATE TABLE public.shift_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) ON DELETE CASCADE NOT NULL UNIQUE,
    status public.approval_status NOT NULL DEFAULT 'DRAFT',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENABLE RLS
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_approvals ENABLE ROW LEVEL SECURITY;

-- 5. HELPER FUNCTIONS

-- Check if shift is locked
CREATE OR REPLACE FUNCTION public.is_shift_locked(_shift_calendar_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shift_approvals 
        WHERE shift_calendar_id = _shift_calendar_id AND status = 'LOCKED'
    )
$$;

-- Check if user is supervisor
CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = _user_id AND role IN ('SUPERVISOR', 'ADMIN')
    )
$$;

-- Check if user is executive
CREATE OR REPLACE FUNCTION public.is_executive(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = _user_id AND role IN ('EXECUTIVE', 'ADMIN')
    )
$$;

-- Get line_id from shift_calendar via plant
CREATE OR REPLACE FUNCTION public.get_line_from_machine(_machine_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT line_id FROM public.machines WHERE id = _machine_id
$$;

-- =============================================
-- RLS POLICIES FOR PRODUCTION_EVENTS
-- =============================================

-- ADMIN: full access
CREATE POLICY "Admins full access to production_events"
ON public.production_events FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- STAFF: SELECT only machines they have permission
CREATE POLICY "Staff can select own machine events"
ON public.production_events FOR SELECT TO authenticated
USING (
    public.has_machine_permission(auth.uid(), machine_id)
);

-- STAFF: INSERT only machines they have permission (shift not locked)
CREATE POLICY "Staff can insert events for permitted machines"
ON public.production_events FOR INSERT TO authenticated
WITH CHECK (
    public.has_machine_permission(auth.uid(), machine_id)
    AND NOT public.is_shift_locked(shift_calendar_id)
    AND created_by = auth.uid()
);

-- STAFF: UPDATE only own events, shift not locked
CREATE POLICY "Staff can update own events if not locked"
ON public.production_events FOR UPDATE TO authenticated
USING (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
)
WITH CHECK (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
);

-- STAFF: DELETE only own events, shift not locked
CREATE POLICY "Staff can delete own events if not locked"
ON public.production_events FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
);

-- =============================================
-- RLS POLICIES FOR PRODUCTION_COUNTS
-- =============================================

-- ADMIN: full access
CREATE POLICY "Admins full access to production_counts"
ON public.production_counts FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- STAFF: SELECT only machines they have permission
CREATE POLICY "Staff can select own machine counts"
ON public.production_counts FOR SELECT TO authenticated
USING (
    public.has_machine_permission(auth.uid(), machine_id)
);

-- STAFF: INSERT only machines they have permission (shift not locked)
CREATE POLICY "Staff can insert counts for permitted machines"
ON public.production_counts FOR INSERT TO authenticated
WITH CHECK (
    public.has_machine_permission(auth.uid(), machine_id)
    AND NOT public.is_shift_locked(shift_calendar_id)
    AND created_by = auth.uid()
);

-- STAFF: UPDATE only own counts, shift not locked
CREATE POLICY "Staff can update own counts if not locked"
ON public.production_counts FOR UPDATE TO authenticated
USING (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
)
WITH CHECK (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
);

-- STAFF: DELETE only own counts, shift not locked
CREATE POLICY "Staff can delete own counts if not locked"
ON public.production_counts FOR DELETE TO authenticated
USING (
    created_by = auth.uid()
    AND NOT public.is_shift_locked(shift_calendar_id)
);

-- =============================================
-- RLS POLICIES FOR SHIFT_APPROVALS
-- =============================================

-- ADMIN: full access
CREATE POLICY "Admins full access to shift_approvals"
ON public.shift_approvals FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- All authenticated can view
CREATE POLICY "Authenticated can view shift_approvals"
ON public.shift_approvals FOR SELECT TO authenticated
USING (true);

-- SUPERVISOR: can insert/update for lines they have permission
CREATE POLICY "Supervisors can manage shift_approvals"
ON public.shift_approvals FOR INSERT TO authenticated
WITH CHECK (
    public.is_supervisor(auth.uid())
    AND public.has_plant_permission(
        auth.uid(), 
        (SELECT plant_id FROM public.shift_calendar WHERE id = shift_calendar_id)
    )
);

CREATE POLICY "Supervisors can update shift_approvals"
ON public.shift_approvals FOR UPDATE TO authenticated
USING (
    public.is_supervisor(auth.uid())
    AND public.has_plant_permission(
        auth.uid(), 
        (SELECT plant_id FROM public.shift_calendar WHERE id = shift_calendar_id)
    )
)
WITH CHECK (
    public.is_supervisor(auth.uid())
);

-- =============================================
-- UPDATE OEE_SNAPSHOTS RLS (EXECUTIVE read-only)
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can view OEE snapshots" ON public.oee_snapshots;
DROP POLICY IF EXISTS "Admins can manage OEE snapshots" ON public.oee_snapshots;

-- ADMIN: full access
CREATE POLICY "Admins full access to oee_snapshots"
ON public.oee_snapshots FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- EXECUTIVE: read-only
CREATE POLICY "Executives can view oee_snapshots"
ON public.oee_snapshots FOR SELECT TO authenticated
USING (public.is_executive(auth.uid()));

-- SUPERVISOR/STAFF with permissions can also view
CREATE POLICY "Users with permissions can view oee_snapshots"
ON public.oee_snapshots FOR SELECT TO authenticated
USING (
    (scope = 'MACHINE' AND public.has_machine_permission(auth.uid(), scope_id))
    OR (scope = 'LINE' AND public.has_line_permission(auth.uid(), scope_id))
    OR (scope = 'PLANT' AND public.has_plant_permission(auth.uid(), scope_id))
);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_production_events_updated_at
    BEFORE UPDATE ON public.production_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_approvals_updated_at
    BEFORE UPDATE ON public.shift_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_production_events_machine ON public.production_events(machine_id);
CREATE INDEX idx_production_events_shift ON public.production_events(shift_calendar_id);
CREATE INDEX idx_production_events_created_by ON public.production_events(created_by);
CREATE INDEX idx_production_counts_machine ON public.production_counts(machine_id);
CREATE INDEX idx_production_counts_shift ON public.production_counts(shift_calendar_id);
CREATE INDEX idx_shift_approvals_status ON public.shift_approvals(status);

-- =============================================
-- VIEWS
-- =============================================

-- View: Current shift by machine
CREATE OR REPLACE VIEW public.v_current_shift_by_machine
WITH (security_invoker = on)
AS
SELECT 
    m.id AS machine_id,
    m.name AS machine_name,
    m.code AS machine_code,
    l.id AS line_id,
    l.name AS line_name,
    p.id AS plant_id,
    p.name AS plant_name,
    sc.id AS shift_calendar_id,
    sc.shift_date,
    s.id AS shift_id,
    s.name AS shift_name,
    s.start_time,
    s.end_time,
    sc.planned_time_minutes,
    COALESCE(sa.status, 'DRAFT') AS approval_status
FROM public.machines m
JOIN public.lines l ON m.line_id = l.id
JOIN public.plants p ON l.plant_id = p.id
CROSS JOIN LATERAL (
    SELECT sc2.* 
    FROM public.shift_calendar sc2
    WHERE sc2.plant_id = p.id
      AND sc2.shift_date = CURRENT_DATE
    ORDER BY sc2.shift_id
    LIMIT 1
) sc
JOIN public.shifts s ON sc.shift_id = s.id
LEFT JOIN public.shift_approvals sa ON sc.id = sa.shift_calendar_id
WHERE m.is_active = true;

-- View: Shift summary with A/P/Q/OEE + status
CREATE OR REPLACE VIEW public.v_shift_summary
WITH (security_invoker = on)
AS
SELECT 
    sc.id AS shift_calendar_id,
    sc.shift_date,
    s.name AS shift_name,
    p.id AS plant_id,
    p.name AS plant_name,
    sc.planned_time_minutes,
    COALESCE(sa.status, 'DRAFT') AS approval_status,
    sa.approved_by,
    sa.approved_at,
    sa.locked_by,
    sa.locked_at,
    -- Aggregated OEE metrics from snapshots
    COALESCE(AVG(os.availability), 0) AS avg_availability,
    COALESCE(AVG(os.performance), 0) AS avg_performance,
    COALESCE(AVG(os.quality), 0) AS avg_quality,
    COALESCE(AVG(os.oee), 0) AS avg_oee,
    COALESCE(SUM(os.run_time_minutes), 0) AS total_run_time,
    COALESCE(SUM(os.downtime_minutes), 0) AS total_downtime,
    COALESCE(SUM(os.good_qty), 0) AS total_good_qty,
    COALESCE(SUM(os.reject_qty), 0) AS total_reject_qty,
    -- Count of machines
    (SELECT COUNT(*) FROM public.machines m 
     JOIN public.lines l ON m.line_id = l.id 
     WHERE l.plant_id = p.id AND m.is_active = true) AS machine_count
FROM public.shift_calendar sc
JOIN public.shifts s ON sc.shift_id = s.id
JOIN public.plants p ON sc.plant_id = p.id
LEFT JOIN public.shift_approvals sa ON sc.id = sa.shift_calendar_id
LEFT JOIN public.oee_snapshots os ON os.period = 'SHIFT' 
    AND os.period_start::DATE = sc.shift_date
    AND os.scope = 'PLANT' 
    AND os.scope_id = p.id
GROUP BY sc.id, sc.shift_date, s.name, p.id, p.name, 
         sc.planned_time_minutes, sa.status, sa.approved_by, 
         sa.approved_at, sa.locked_by, sa.locked_at;