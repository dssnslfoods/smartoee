-- ========================================================================================
-- 01_schema.sql - OEE Manufacturing Dashboard Schema
-- Generated automatically for Supabase Migration
-- ========================================================================================

-- === EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === ENUM TYPES ===
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('ADMIN', 'EXECUTIVE', 'MANAGER', 'SUPERVISOR', 'STAFF', 'OPERATOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'LOCKED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.downtime_category AS ENUM ('PLANNED', 'UNPLANNED', 'PERFORMANCE_LOSS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.event_type AS ENUM ('RUN', 'SETUP', 'DOWNTIME', 'BREAK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.oee_scope AS ENUM ('MACHINE', 'LINE', 'PLANT', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.oee_period AS ENUM ('SHIFT', 'DAY', 'WEEK', 'MONTH', 'YEAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- === HELPER FUNCTIONS FOR UPDATED_AT ===
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === TABLES ===

-- 1. companies
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. plants
CREATE TABLE IF NOT EXISTS public.plants (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT
);

-- 3. lines
CREATE TABLE IF NOT EXISTS public.lines (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
    name text NOT NULL,
    code text UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT
);

-- 4. machines
CREATE TABLE IF NOT EXISTS public.machines (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    line_id uuid NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    ideal_cycle_time_seconds numeric NOT NULL DEFAULT 60,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    target_oee numeric DEFAULT 85.00,
    target_availability numeric DEFAULT 90.00,
    target_performance numeric DEFAULT 95.00,
    target_quality numeric DEFAULT 99.00,
    time_unit text NOT NULL DEFAULT 'seconds'
);

-- 5. defect_reasons
CREATE TABLE IF NOT EXISTS public.defect_reasons (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT
);

-- 6. downtime_reasons
CREATE TABLE IF NOT EXISTS public.downtime_reasons (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    category public.downtime_category NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT
);

-- 7. holidays
CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    plant_id uuid REFERENCES public.plants(id) ON DELETE RESTRICT,
    holiday_date date NOT NULL,
    name text NOT NULL,
    description text,
    is_recurring boolean NOT NULL DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(company_id, plant_id, holiday_date)
);

-- 8. machine_permission_groups
CREATE TABLE IF NOT EXISTS public.machine_permission_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 9. machine_permission_group_machines
CREATE TABLE IF NOT EXISTS public.machine_permission_group_machines (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.machine_permission_groups(id) ON DELETE CASCADE,
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(group_id, machine_id)
);

-- 10. products
CREATE TABLE IF NOT EXISTS public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    line_id uuid REFERENCES public.lines(id) ON DELETE RESTRICT,
    UNIQUE(company_id, code)
);

-- 11. setup_reasons
CREATE TABLE IF NOT EXISTS public.setup_reasons (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL,
    name text NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 12. shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    effective_from date NOT NULL DEFAULT CURRENT_DATE,
    working_days integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT
);

-- 13. shift_calendar
CREATE TABLE IF NOT EXISTS public.shift_calendar (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    shift_date date NOT NULL,
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
    planned_time_minutes integer NOT NULL DEFAULT 480,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(shift_id, shift_date, plant_id)
);

-- 14. shift_approvals
CREATE TABLE IF NOT EXISTS public.shift_approvals (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_calendar_id uuid NOT NULL REFERENCES public.shift_calendar(id) ON DELETE CASCADE,
    status public.approval_status NOT NULL DEFAULT 'DRAFT',
    approved_by uuid,
    approved_at timestamp with time zone,
    locked_by uuid,
    locked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(shift_calendar_id)
);

-- 15. planned_time_templates
CREATE TABLE IF NOT EXISTS public.planned_time_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE RESTRICT,
    shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    break_minutes integer NOT NULL DEFAULT 0,
    meal_minutes integer NOT NULL DEFAULT 0,
    meeting_minutes integer NOT NULL DEFAULT 0,
    maintenance_minutes integer NOT NULL DEFAULT 0,
    other_minutes integer NOT NULL DEFAULT 0,
    other_label text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    effective_from date NOT NULL DEFAULT CURRENT_DATE,
    break_start_time time without time zone,
    break_end_time time without time zone,
    UNIQUE(plant_id, shift_id)
);

-- 16. production_standards
CREATE TABLE IF NOT EXISTS public.production_standards (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    ideal_cycle_time_seconds numeric NOT NULL DEFAULT 60,
    std_setup_time_seconds numeric NOT NULL DEFAULT 0,
    target_quality numeric NOT NULL DEFAULT 99.00,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(machine_id, product_id)
);

-- 17. production_events
CREATE TABLE IF NOT EXISTS public.production_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
    line_id uuid NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    shift_calendar_id uuid REFERENCES public.shift_calendar(id) ON DELETE SET NULL,
    event_type public.event_type NOT NULL,
    reason_id uuid,
    start_ts timestamp with time zone NOT NULL DEFAULT now(),
    end_ts timestamp with time zone,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT
);

-- 18. production_counts
CREATE TABLE IF NOT EXISTS public.production_counts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_calendar_id uuid REFERENCES public.shift_calendar(id) ON DELETE SET NULL,
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    ts timestamp with time zone NOT NULL DEFAULT now(),
    good_qty integer NOT NULL DEFAULT 0,
    reject_qty integer NOT NULL DEFAULT 0,
    defect_reason_id uuid REFERENCES public.defect_reasons(id) ON DELETE RESTRICT,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    production_event_id uuid REFERENCES public.production_events(id) ON DELETE RESTRICT
);

-- 19. oee_snapshots
CREATE TABLE IF NOT EXISTS public.oee_snapshots (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    scope public.oee_scope NOT NULL,
    scope_id uuid NOT NULL,
    period public.oee_period NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    availability numeric,
    performance numeric,
    quality numeric,
    oee numeric,
    run_time_minutes integer,
    downtime_minutes integer,
    planned_time_minutes integer,
    good_qty integer,
    reject_qty integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    shift_calendar_id uuid REFERENCES public.shift_calendar(id) ON DELETE SET NULL
);

-- 20. user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE, -- Links to auth.users
    full_name text NOT NULL,
    role public.app_role NOT NULL DEFAULT 'STAFF',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
    email text
);

-- 21. user_plant_permissions
CREATE TABLE IF NOT EXISTS public.user_plant_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, plant_id)
);

-- 22. user_line_permissions
CREATE TABLE IF NOT EXISTS public.user_line_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    line_id uuid NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, line_id)
);

-- 23. user_machine_permissions
CREATE TABLE IF NOT EXISTS public.user_machine_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, machine_id)
);

-- 24. user_permission_groups
CREATE TABLE IF NOT EXISTS public.user_permission_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    group_id uuid NOT NULL REFERENCES public.machine_permission_groups(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, group_id)
);

-- 25. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    before_json jsonb,
    after_json jsonb,
    actor_user_id uuid,
    ts timestamp with time zone NOT NULL DEFAULT now()
);


-- === TRIGGERS FOR UPDATED_AT ===

CREATE TRIGGER update_companies_modtime BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_plants_modtime BEFORE UPDATE ON public.plants FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_lines_modtime BEFORE UPDATE ON public.lines FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_machines_modtime BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_holidays_modtime BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_machine_permission_groups_modtime BEFORE UPDATE ON public.machine_permission_groups FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_shift_approvals_modtime BEFORE UPDATE ON public.shift_approvals FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_planned_time_templates_modtime BEFORE UPDATE ON public.planned_time_templates FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_production_standards_modtime BEFORE UPDATE ON public.production_standards FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_production_events_modtime BEFORE UPDATE ON public.production_events FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER update_user_profiles_modtime BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- === INDEXES (Filtering / Joins) ===

-- companies
CREATE INDEX IF NOT EXISTS idx_companies_code ON public.companies(code);

-- plants
CREATE INDEX IF NOT EXISTS idx_plants_company_id ON public.plants(company_id);
CREATE INDEX IF NOT EXISTS idx_plants_code ON public.plants(code);

-- lines
CREATE INDEX IF NOT EXISTS idx_lines_plant_id ON public.lines(plant_id);
CREATE INDEX IF NOT EXISTS idx_lines_company_id ON public.lines(company_id);

-- machines
CREATE INDEX IF NOT EXISTS idx_machines_line_id ON public.machines(line_id);
CREATE INDEX IF NOT EXISTS idx_machines_code ON public.machines(code);
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON public.machines(company_id);

-- defect_reasons
CREATE INDEX IF NOT EXISTS idx_defect_reasons_company_id ON public.defect_reasons(company_id);
CREATE INDEX IF NOT EXISTS idx_defect_reasons_code ON public.defect_reasons(code);

-- downtime_reasons
CREATE INDEX IF NOT EXISTS idx_downtime_reasons_company_id ON public.downtime_reasons(company_id);
CREATE INDEX IF NOT EXISTS idx_downtime_reasons_code ON public.downtime_reasons(code);

-- setup_reasons
CREATE INDEX IF NOT EXISTS idx_setup_reasons_company_id ON public.setup_reasons(company_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_line_id ON public.products(line_id);

-- production_events
CREATE INDEX IF NOT EXISTS idx_production_events_machine_id ON public.production_events(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_events_shift_calendar_id ON public.production_events(shift_calendar_id);
CREATE INDEX IF NOT EXISTS idx_production_events_start_ts ON public.production_events(start_ts);

-- production_counts
CREATE INDEX IF NOT EXISTS idx_production_counts_machine_id ON public.production_counts(machine_id);
CREATE INDEX IF NOT EXISTS idx_production_counts_shift_calendar_id ON public.production_counts(shift_calendar_id);
CREATE INDEX IF NOT EXISTS idx_production_counts_ts ON public.production_counts(ts);

-- shift_calendar
CREATE INDEX IF NOT EXISTS idx_shift_calendar_shift_date ON public.shift_calendar(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_calendar_plant_id ON public.shift_calendar(plant_id);

-- oee_snapshots
CREATE INDEX IF NOT EXISTS idx_oee_snapshots_scope_id ON public.oee_snapshots(scope_id);
CREATE INDEX IF NOT EXISTS idx_oee_snapshots_period_start ON public.oee_snapshots(period_start);
CREATE INDEX IF NOT EXISTS idx_oee_snapshots_shift_calendar_id ON public.oee_snapshots(shift_calendar_id);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON public.audit_logs(ts);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
