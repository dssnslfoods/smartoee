-- Update has_machine_permission to also check if user is supervisor of the machine's company
CREATE OR REPLACE FUNCTION public.has_machine_permission(_user_id uuid, _machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
$$;

-- Allow Supervisors to manage machine permissions for users in their company
DROP POLICY IF EXISTS "Supervisors can manage machine permissions in their company" ON public.user_machine_permissions;
CREATE POLICY "Supervisors can manage machine permissions in their company"
ON public.user_machine_permissions
FOR ALL
USING (
    -- Supervisor can manage permissions for staff in their company
    EXISTS (
        SELECT 1 
        FROM public.user_profiles supervisor_profile
        JOIN public.user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
        WHERE supervisor_profile.user_id = auth.uid()
          AND supervisor_profile.role = 'SUPERVISOR'
          AND staff_profile.user_id = user_machine_permissions.user_id
          AND staff_profile.role = 'STAFF'
    )
)
WITH CHECK (
    -- Can only assign permissions to staff in their company for machines in their company
    EXISTS (
        SELECT 1 
        FROM public.user_profiles supervisor_profile
        JOIN public.user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
        JOIN public.machines m ON m.company_id = supervisor_profile.company_id
        WHERE supervisor_profile.user_id = auth.uid()
          AND supervisor_profile.role = 'SUPERVISOR'
          AND staff_profile.user_id = user_machine_permissions.user_id
          AND staff_profile.role = 'STAFF'
          AND m.id = user_machine_permissions.machine_id
    )
);