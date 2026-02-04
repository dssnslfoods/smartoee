-- =============================================
-- PNF OEE System - Database Schema
-- Run this in Supabase SQL Editor (supabase.com)
-- =============================================

-- =============================================
-- 1. ENUMS
-- =============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'executive', 'supervisor', 'staff');
CREATE TYPE public.event_type AS ENUM ('RUN', 'DOWNTIME', 'SETUP');
CREATE TYPE public.approval_status AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');
CREATE TYPE public.oee_scope AS ENUM ('MACHINE', 'LINE', 'PLANT');
CREATE TYPE public.oee_period AS ENUM ('SHIFT', 'DAY');

-- =============================================
-- 2. USER MANAGEMENT TABLES
-- =============================================

-- User Profiles
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User Roles (separate table for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, role)
);

-- =============================================
-- 3. PLANT HIERARCHY
-- =============================================

-- Plants
CREATE TABLE public.plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Production Lines
CREATE TABLE public.lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Machines
CREATE TABLE public.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    ideal_cycle_time_seconds NUMERIC(10,3) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- 4. SHIFT MANAGEMENT
-- =============================================

-- Shifts definition
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Shift Calendar (specific shift on specific date for specific plant)
CREATE TABLE public.shift_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES public.shifts(id) NOT NULL,
    shift_date DATE NOT NULL,
    plant_id UUID REFERENCES public.plants(id) NOT NULL,
    planned_time_minutes INTEGER DEFAULT 480 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (shift_id, shift_date, plant_id)
);

-- =============================================
-- 5. MASTER DATA
-- =============================================

-- Downtime Reasons
CREATE TABLE public.downtime_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'PLANNED', 'UNPLANNED', 'BREAKDOWN', 'CHANGEOVER'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Defect Reasons
CREATE TABLE public.defect_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- 6. TRANSACTION TABLES
-- =============================================

-- Production Events (Run, Downtime, Setup periods)
CREATE TABLE public.production_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID REFERENCES public.plants(id) NOT NULL,
    line_id UUID REFERENCES public.lines(id) NOT NULL,
    machine_id UUID REFERENCES public.machines(id) NOT NULL,
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) NOT NULL,
    event_type event_type NOT NULL,
    reason_id UUID REFERENCES public.downtime_reasons(id),
    start_ts TIMESTAMPTZ NOT NULL,
    end_ts TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Production Counts (Good and Reject quantities)
CREATE TABLE public.production_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) NOT NULL,
    machine_id UUID REFERENCES public.machines(id) NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    good_qty INTEGER DEFAULT 0 NOT NULL,
    reject_qty INTEGER DEFAULT 0 NOT NULL,
    defect_reason_id UUID REFERENCES public.defect_reasons(id),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- 7. CONTROL TABLES
-- =============================================

-- Shift Approvals
CREATE TABLE public.shift_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_calendar_id UUID REFERENCES public.shift_calendar(id) NOT NULL UNIQUE,
    status approval_status DEFAULT 'DRAFT' NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- 8. OUTPUT TABLES
-- =============================================

-- OEE Snapshots (aggregated OEE data)
CREATE TABLE public.oee_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope oee_scope NOT NULL,
    scope_id UUID NOT NULL,
    period oee_period NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    availability NUMERIC(5,2) DEFAULT 0 NOT NULL,
    performance NUMERIC(5,2) DEFAULT 0 NOT NULL,
    quality NUMERIC(5,2) DEFAULT 0 NOT NULL,
    oee NUMERIC(5,2) DEFAULT 0 NOT NULL,
    run_time_minutes INTEGER DEFAULT 0 NOT NULL,
    downtime_minutes INTEGER DEFAULT 0 NOT NULL,
    planned_time_minutes INTEGER DEFAULT 0 NOT NULL,
    good_qty INTEGER DEFAULT 0 NOT NULL,
    reject_qty INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (scope, scope_id, period, period_start)
);

-- =============================================
-- 9. AUDIT TABLES
-- =============================================

-- Audit Logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    before_json JSONB,
    after_json JSONB,
    actor_user_id UUID REFERENCES auth.users(id),
    ts TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- 10. INDEXES FOR PERFORMANCE
-- =============================================

-- User tables
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Hierarchy tables
CREATE INDEX idx_lines_plant_id ON public.lines(plant_id);
CREATE INDEX idx_machines_line_id ON public.machines(line_id);
CREATE INDEX idx_machines_code ON public.machines(code);

-- Shift tables
CREATE INDEX idx_shift_calendar_date ON public.shift_calendar(shift_date);
CREATE INDEX idx_shift_calendar_plant_id ON public.shift_calendar(plant_id);
CREATE INDEX idx_shift_calendar_shift_date_plant ON public.shift_calendar(shift_date, plant_id);

-- Transaction tables
CREATE INDEX idx_production_events_machine_id ON public.production_events(machine_id);
CREATE INDEX idx_production_events_shift_calendar_id ON public.production_events(shift_calendar_id);
CREATE INDEX idx_production_events_event_type ON public.production_events(event_type);
CREATE INDEX idx_production_events_start_ts ON public.production_events(start_ts);
CREATE INDEX idx_production_events_machine_shift ON public.production_events(machine_id, shift_calendar_id);

CREATE INDEX idx_production_counts_machine_id ON public.production_counts(machine_id);
CREATE INDEX idx_production_counts_shift_calendar_id ON public.production_counts(shift_calendar_id);
CREATE INDEX idx_production_counts_ts ON public.production_counts(ts);

-- Control tables
CREATE INDEX idx_shift_approvals_status ON public.shift_approvals(status);

-- Output tables
CREATE INDEX idx_oee_snapshots_scope ON public.oee_snapshots(scope, scope_id);
CREATE INDEX idx_oee_snapshots_period ON public.oee_snapshots(period, period_start);
CREATE INDEX idx_oee_snapshots_scope_period ON public.oee_snapshots(scope, scope_id, period, period_start);

-- Audit tables
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_ts ON public.audit_logs(ts);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);

-- =============================================
-- 11. SECURITY DEFINER FUNCTION FOR ROLE CHECK
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to get user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
$$;

-- =============================================
-- 12. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oee_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 13. ROW LEVEL SECURITY POLICIES
-- =============================================

-- User Profiles: Users can read all, update own
CREATE POLICY "Users can view all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User Roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Plants: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read plants" ON public.plants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage plants" ON public.plants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lines: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read lines" ON public.lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lines" ON public.lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Machines: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read machines" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage machines" ON public.machines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shifts: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shifts" ON public.shifts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Shift Calendar: All authenticated can read, supervisors+ can manage
CREATE POLICY "Authenticated can read shift_calendar" ON public.shift_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage shift_calendar" ON public.shift_calendar FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Downtime Reasons: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read downtime_reasons" ON public.downtime_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage downtime_reasons" ON public.downtime_reasons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Defect Reasons: All authenticated can read, admins can manage
CREATE POLICY "Authenticated can read defect_reasons" ON public.defect_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage defect_reasons" ON public.defect_reasons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Production Events: All authenticated can read, staff+ can insert/update
CREATE POLICY "Authenticated can read production_events" ON public.production_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert production_events" ON public.production_events FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Staff can update own production_events" ON public.production_events FOR UPDATE TO authenticated 
    USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Production Counts: All authenticated can read, staff+ can insert
CREATE POLICY "Authenticated can read production_counts" ON public.production_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert production_counts" ON public.production_counts FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = created_by);

-- Shift Approvals: All authenticated can read, supervisors+ can manage
CREATE POLICY "Authenticated can read shift_approvals" ON public.shift_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage shift_approvals" ON public.shift_approvals FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- OEE Snapshots: All authenticated can read
CREATE POLICY "Authenticated can read oee_snapshots" ON public.oee_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage oee_snapshots" ON public.oee_snapshots FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Audit Logs: Only admins can read
CREATE POLICY "Admins can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated 
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'executive'));

-- =============================================
-- 14. TRIGGER FOR AUTO-CREATE PROFILE
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    -- Assign default 'staff' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 15. UPDATE TIMESTAMP TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON public.plants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lines_updated_at
    BEFORE UPDATE ON public.lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON public.machines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_production_events_updated_at
    BEFORE UPDATE ON public.production_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_shift_approvals_updated_at
    BEFORE UPDATE ON public.shift_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
