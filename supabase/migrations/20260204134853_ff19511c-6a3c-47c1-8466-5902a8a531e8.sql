-- =============================================
-- PNF OEE SYSTEM - COMPLETE SCHEMA
-- =============================================

-- 1. ENUMS
CREATE TYPE public.event_type AS ENUM ('RUN', 'DOWNTIME', 'SETUP');
CREATE TYPE public.approval_status AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');
CREATE TYPE public.oee_scope AS ENUM ('MACHINE', 'LINE', 'PLANT');
CREATE TYPE public.oee_period AS ENUM ('SHIFT', 'DAY');
CREATE TYPE public.downtime_category AS ENUM ('PLANNED', 'UNPLANNED', 'BREAKDOWN', 'CHANGEOVER');
CREATE TYPE public.app_role AS ENUM ('STAFF', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN');

-- 2. PLANT HIERARCHY

-- Plants
CREATE TABLE public.plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lines
CREATE TABLE public.lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Machines
CREATE TABLE public.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    ideal_cycle_time_seconds NUMERIC(10,2) NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SHIFT MANAGEMENT

CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shift_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    shift_date DATE NOT NULL,
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE NOT NULL,
    planned_time_minutes INTEGER NOT NULL DEFAULT 480,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(shift_id, shift_date, plant_id)
);

-- 4. MASTER DATA

CREATE TABLE public.downtime_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category public.downtime_category NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.defect_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. OEE SNAPSHOTS

CREATE TABLE public.oee_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope public.oee_scope NOT NULL,
    scope_id UUID NOT NULL,
    period public.oee_period NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    availability NUMERIC(5,2),
    performance NUMERIC(5,2),
    quality NUMERIC(5,2),
    oee NUMERIC(5,2),
    run_time_minutes INTEGER,
    downtime_minutes INTEGER,
    planned_time_minutes INTEGER,
    good_qty INTEGER,
    reject_qty INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. USER PROFILES & PERMISSIONS

CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'STAFF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_machine_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, machine_id)
);

CREATE TABLE public.user_line_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, line_id)
);

CREATE TABLE public.user_plant_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, plant_id)
);

-- 7. ENABLE RLS ON ALL TABLES

ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oee_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_machine_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_line_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plant_permissions ENABLE ROW LEVEL SECURITY;

-- 8. SECURITY DEFINER FUNCTIONS

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_profiles WHERE user_id = _user_id
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = _user_id AND role = 'ADMIN'
    )
$$;

-- Check machine permission
CREATE OR REPLACE FUNCTION public.has_machine_permission(_user_id UUID, _machine_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_machine_permissions 
        WHERE user_id = _user_id AND machine_id = _machine_id
    ) OR public.is_admin(_user_id)
$$;

-- Check line permission
CREATE OR REPLACE FUNCTION public.has_line_permission(_user_id UUID, _line_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_line_permissions 
        WHERE user_id = _user_id AND line_id = _line_id
    ) OR public.is_admin(_user_id)
$$;

-- Check plant permission
CREATE OR REPLACE FUNCTION public.has_plant_permission(_user_id UUID, _plant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_plant_permissions 
        WHERE user_id = _user_id AND plant_id = _plant_id
    ) OR public.is_admin(_user_id)
$$;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 9. RLS POLICIES

-- Plants (read for authenticated, write for admin)
CREATE POLICY "Authenticated users can view plants"
ON public.plants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage plants"
ON public.plants FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Lines (read for authenticated, write for admin)
CREATE POLICY "Authenticated users can view lines"
ON public.lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage lines"
ON public.lines FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Machines (read for authenticated, write for admin)
CREATE POLICY "Authenticated users can view machines"
ON public.machines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage machines"
ON public.machines FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Shifts (read for all, write for admin)
CREATE POLICY "Authenticated users can view shifts"
ON public.shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage shifts"
ON public.shifts FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Shift Calendar (read for all, write for admin)
CREATE POLICY "Authenticated users can view shift calendar"
ON public.shift_calendar FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage shift calendar"
ON public.shift_calendar FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Downtime Reasons (read for all, write for admin)
CREATE POLICY "Authenticated users can view downtime reasons"
ON public.downtime_reasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage downtime reasons"
ON public.downtime_reasons FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Defect Reasons (read for all, write for admin)
CREATE POLICY "Authenticated users can view defect reasons"
ON public.defect_reasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage defect reasons"
ON public.defect_reasons FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- OEE Snapshots (read for all authenticated)
CREATE POLICY "Authenticated users can view OEE snapshots"
ON public.oee_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage OEE snapshots"
ON public.oee_snapshots FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- User Profiles
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
ON public.user_profiles FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Permission tables (admin only + users can view own)
CREATE POLICY "Admins can manage machine permissions"
ON public.user_machine_permissions FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own machine permissions"
ON public.user_machine_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage line permissions"
ON public.user_line_permissions FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own line permissions"
ON public.user_line_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage plant permissions"
ON public.user_plant_permissions FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own plant permissions"
ON public.user_plant_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 10. TRIGGERS

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'STAFF'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_plants_updated_at
    BEFORE UPDATE ON public.plants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lines_updated_at
    BEFORE UPDATE ON public.lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON public.machines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. INDEXES
CREATE INDEX idx_lines_plant_id ON public.lines(plant_id);
CREATE INDEX idx_machines_line_id ON public.machines(line_id);
CREATE INDEX idx_shift_calendar_date ON public.shift_calendar(shift_date);
CREATE INDEX idx_oee_snapshots_scope ON public.oee_snapshots(scope, scope_id);
CREATE INDEX idx_oee_snapshots_period ON public.oee_snapshots(period_start, period_end);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_machine_permissions_user ON public.user_machine_permissions(user_id);
CREATE INDEX idx_user_line_permissions_user ON public.user_line_permissions(user_id);
CREATE INDEX idx_user_plant_permissions_user ON public.user_plant_permissions(user_id);