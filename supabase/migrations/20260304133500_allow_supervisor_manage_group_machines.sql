-- Allow Supervisors to manage machines in permission groups
DROP POLICY IF EXISTS "Supervisors can manage group machines in company" ON public.machine_permission_group_machines;
CREATE POLICY "Supervisors can manage group machines in company" ON public.machine_permission_group_machines FOR ALL TO authenticated 
USING (
    public.is_supervisor() AND 
    EXISTS (
        SELECT 1 FROM public.machine_permission_groups g 
        WHERE g.id = group_id AND g.company_id = public.get_user_company_id()
    )
);
