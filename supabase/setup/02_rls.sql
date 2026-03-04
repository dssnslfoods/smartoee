-- ========================================================================================
-- 02_rls.sql - Row Level Security & Policies
-- Generated automatically for Supabase Migration
-- ========================================================================================

-- === 1. HELPER FUNCTIONS ===

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT role FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPERVISOR')
    );
$$;

CREATE OR REPLACE FUNCTION public.has_plant_access(_plant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT 
        public.is_admin_or_manager()
        OR EXISTS (
            SELECT 1 FROM public.user_plant_permissions 
            WHERE user_id = auth.uid() AND plant_id = _plant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.plants p ON p.company_id = up.company_id
            WHERE up.user_id = auth.uid() 
              AND up.role = 'SUPERVISOR'
              AND p.id = _plant_id
        );
$$;

CREATE OR REPLACE FUNCTION public.has_machine_access(_machine_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
    SELECT 
        public.is_admin_or_manager()
        OR EXISTS (
            SELECT 1 FROM public.user_machine_permissions 
            WHERE user_id = auth.uid() AND machine_id = _machine_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_permission_groups upg
            JOIN public.machine_permission_group_machines mpgm ON mpgm.group_id = upg.group_id
            WHERE upg.user_id = auth.uid() AND mpgm.machine_id = _machine_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.machines m ON m.company_id = up.company_id
            WHERE up.user_id = auth.uid() 
              AND up.role = 'SUPERVISOR'
              AND m.id = _machine_id
        );
$$;

-- === 2. ENABLE ROW LEVEL SECURITY ===

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_permission_group_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_time_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oee_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plant_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_line_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_machine_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- === 3. POLICIES ===

-- -----------------------------------------------------
-- user_profiles (Must allow insert for triggers mapping)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage active profiles" ON public.user_profiles;
CREATE POLICY "Admins can manage active profiles" ON public.user_profiles FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage profiles in their company" ON public.user_profiles;
CREATE POLICY "Supervisors can manage profiles in their company" ON public.user_profiles FOR ALL TO authenticated USING (public.is_supervisor() AND company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view and update own profile" ON public.user_profiles;
CREATE POLICY "Users can view and update own profile" ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_manager() OR (public.is_supervisor() AND company_id = public.get_user_company_id()));

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- -----------------------------------------------------
-- companies
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
CREATE POLICY "Admins can manage companies" ON public.companies FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
CREATE POLICY "Users can view companies" ON public.companies FOR SELECT TO authenticated USING (true);


-- -----------------------------------------------------
-- Master Data Tables (plants, lines, machines, defect_reasons, downtime_reasons, holidays, products, setup_reasons, shifts, planned_time_templates, production_standards)
-- -----------------------------------------------------
DO $$ DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['plants', 'lines', 'machines', 'defect_reasons', 'downtime_reasons', 'holidays', 'products', 'setup_reasons', 'shifts', 'planned_time_templates', 'production_standards'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Admins can manage %s" ON public.%s FOR ALL TO authenticated USING (public.is_admin_or_manager());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Supervisors can manage %s in their company" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Supervisors can manage %s in their company" ON public.%s FOR ALL TO authenticated USING (public.is_supervisor() AND company_id = public.get_user_company_id());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Users can view %s in their company" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Users can view %s in their company" ON public.%s FOR SELECT TO authenticated USING (company_id = public.get_user_company_id() OR public.is_admin_or_manager());', t, t);
    END LOOP;
END $$;


-- -----------------------------------------------------
-- Machine Permission Groups & Mappings
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage permission groups" ON public.machine_permission_groups;
CREATE POLICY "Admins can manage permission groups" ON public.machine_permission_groups FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage groups in company" ON public.machine_permission_groups;
CREATE POLICY "Supervisors can manage groups in company" ON public.machine_permission_groups FOR ALL TO authenticated USING (public.is_supervisor() AND company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can view groups in company" ON public.machine_permission_groups;
CREATE POLICY "Users can view groups in company" ON public.machine_permission_groups FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Admins can manage group machines" ON public.machine_permission_group_machines;
CREATE POLICY "Admins can manage group machines" ON public.machine_permission_group_machines FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage group machines in company" ON public.machine_permission_group_machines;
CREATE POLICY "Supervisors can manage group machines in company" ON public.machine_permission_group_machines FOR ALL TO authenticated 
USING (
    public.is_supervisor() AND 
    EXISTS (
        SELECT 1 FROM public.machine_permission_groups g 
        WHERE g.id = group_id AND g.company_id = public.get_user_company_id()
    )
);

DROP POLICY IF EXISTS "Users can view their group machines" ON public.machine_permission_group_machines;
CREATE POLICY "Users can view their group machines" ON public.machine_permission_group_machines FOR SELECT TO authenticated USING (true);


-- -----------------------------------------------------
-- User Permissions (user_plant_permissions, user_line_permissions, user_machine_permissions, user_permission_groups)
-- -----------------------------------------------------
DO $$ DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['user_plant_permissions', 'user_line_permissions', 'user_machine_permissions', 'user_permission_groups'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Admins can manage %s" ON public.%s FOR ALL TO authenticated USING (public.is_admin_or_manager());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Supervisors can manage %s in company" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Supervisors can manage %s in company" ON public.%s FOR ALL TO authenticated USING (public.is_supervisor());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Users can view own %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Users can view own %s" ON public.%s FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_supervisor());', t, t);
    END LOOP;
END $$;


-- -----------------------------------------------------
-- Operations (production_events, production_counts)
-- -----------------------------------------------------
DO $$ DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['production_events', 'production_counts'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins full access to %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Admins full access to %s" ON public.%s FOR ALL TO authenticated USING (public.is_admin_or_manager());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Staff can insert %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Staff can insert %s" ON public.%s FOR INSERT TO authenticated WITH CHECK (public.has_machine_access(machine_id) AND created_by = auth.uid());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Staff can select %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Staff can select %s" ON public.%s FOR SELECT TO authenticated USING (public.has_machine_access(machine_id) OR public.is_supervisor());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Staff can update own %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Staff can update own %s" ON public.%s FOR UPDATE TO authenticated USING ((created_by = auth.uid() AND public.has_machine_access(machine_id)) OR public.is_supervisor());', t, t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Staff can delete own %s" ON public.%s;', t, t);
        EXECUTE format('CREATE POLICY "Staff can delete own %s" ON public.%s FOR DELETE TO authenticated USING ((created_by = auth.uid() AND public.has_machine_access(machine_id)) OR public.is_supervisor());', t, t);
    END LOOP;
END $$;


-- -----------------------------------------------------
-- shift_calendar
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage shift calendar" ON public.shift_calendar;
CREATE POLICY "Admins can manage shift calendar" ON public.shift_calendar FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view shift calendar" ON public.shift_calendar;
CREATE POLICY "Users can view shift calendar" ON public.shift_calendar FOR SELECT TO authenticated USING (true);


-- -----------------------------------------------------
-- shift_approvals
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage shift approvals" ON public.shift_approvals;
CREATE POLICY "Admins can manage shift approvals" ON public.shift_approvals FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Supervisors can manage shift approvals" ON public.shift_approvals;
CREATE POLICY "Supervisors can manage shift approvals" ON public.shift_approvals FOR ALL TO authenticated USING (public.is_supervisor());

DROP POLICY IF EXISTS "Users can view shift approvals" ON public.shift_approvals;
CREATE POLICY "Users can view shift approvals" ON public.shift_approvals FOR SELECT TO authenticated USING (true);


-- -----------------------------------------------------
-- oee_snapshots
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage oee_snapshots" ON public.oee_snapshots;
CREATE POLICY "Admins can manage oee_snapshots" ON public.oee_snapshots FOR ALL TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Users can view oee_snapshots" ON public.oee_snapshots;
CREATE POLICY "Users can view oee_snapshots" ON public.oee_snapshots FOR SELECT TO authenticated USING (true);


-- -----------------------------------------------------
-- audit_logs
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin_or_manager());

DROP POLICY IF EXISTS "Staff can view own audit logs" ON public.audit_logs;
CREATE POLICY "Staff can view own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (actor_user_id = auth.uid());

