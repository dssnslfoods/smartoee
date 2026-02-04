-- Create machine permission groups table
CREATE TABLE public.machine_permission_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group-machine mapping table
CREATE TABLE public.machine_permission_group_machines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.machine_permission_groups(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(group_id, machine_id)
);

-- Create user-group assignment table
CREATE TABLE public.user_permission_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    group_id UUID NOT NULL REFERENCES public.machine_permission_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, group_id)
);

-- Enable RLS
ALTER TABLE public.machine_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_permission_group_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for machine_permission_groups
CREATE POLICY "Admins full access to permission groups"
ON public.machine_permission_groups FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage groups in their company"
ON public.machine_permission_groups FOR ALL
USING (public.is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (public.is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view groups in their company"
ON public.machine_permission_groups FOR SELECT
USING (company_id = public.get_user_company(auth.uid()));

-- RLS policies for machine_permission_group_machines
CREATE POLICY "Admins full access to group machines"
ON public.machine_permission_group_machines FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage group machines in their company"
ON public.machine_permission_group_machines FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.machine_permission_groups g
        WHERE g.id = group_id
        AND public.is_supervisor_of_company(auth.uid(), g.company_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.machine_permission_groups g
        WHERE g.id = group_id
        AND public.is_supervisor_of_company(auth.uid(), g.company_id)
    )
);

CREATE POLICY "Users can view group machines in their company"
ON public.machine_permission_group_machines FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.machine_permission_groups g
        WHERE g.id = group_id
        AND g.company_id = public.get_user_company(auth.uid())
    )
);

-- RLS policies for user_permission_groups
CREATE POLICY "Admins full access to user groups"
ON public.user_permission_groups FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage user groups for staff in their company"
ON public.user_permission_groups FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.machine_permission_groups g ON g.company_id = up.company_id
        WHERE up.user_id = user_permission_groups.user_id
        AND up.role = 'STAFF'
        AND g.id = user_permission_groups.group_id
        AND public.is_supervisor_of_company(auth.uid(), up.company_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.machine_permission_groups g ON g.company_id = up.company_id
        WHERE up.user_id = user_permission_groups.user_id
        AND up.role = 'STAFF'
        AND g.id = user_permission_groups.group_id
        AND public.is_supervisor_of_company(auth.uid(), up.company_id)
    )
);

CREATE POLICY "Users can view own group assignments"
ON public.user_permission_groups FOR SELECT
USING (user_id = auth.uid());

-- Update has_machine_permission function to include group-based permissions
CREATE OR REPLACE FUNCTION public.has_machine_permission(_user_id uuid, _machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- Direct machine permission
        SELECT 1 FROM public.user_machine_permissions 
        WHERE user_id = _user_id AND machine_id = _machine_id
    ) 
    OR public.is_admin(_user_id)
    OR EXISTS (
        -- Supervisor with same company as the machine
        SELECT 1 
        FROM public.user_profiles up
        JOIN public.machines m ON m.company_id = up.company_id
        WHERE up.user_id = _user_id 
          AND up.role = 'SUPERVISOR'
          AND m.id = _machine_id
    )
    OR EXISTS (
        -- Group-based permission
        SELECT 1 
        FROM public.user_permission_groups upg
        JOIN public.machine_permission_group_machines mpgm ON mpgm.group_id = upg.group_id
        WHERE upg.user_id = _user_id 
          AND mpgm.machine_id = _machine_id
    )
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_machine_permission_groups_updated_at
BEFORE UPDATE ON public.machine_permission_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();