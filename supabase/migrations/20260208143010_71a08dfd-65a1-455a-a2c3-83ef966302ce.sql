
-- Create a function that returns machine IDs the current user has permission to access
-- ADMIN: all machines (regardless of company, since admin selects company context)
-- SUPERVISOR: all machines in their company
-- STAFF: only machines assigned directly or via permission groups
CREATE OR REPLACE FUNCTION public.get_user_permitted_machine_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin: all active machines
  SELECT m.id FROM machines m
  WHERE m.is_active = true
    AND is_admin(auth.uid())

  UNION

  -- Supervisor: all machines in their company
  SELECT m.id FROM machines m
  WHERE m.is_active = true
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'SUPERVISOR'
      AND up.company_id = m.company_id
    )

  UNION

  -- Staff: direct machine permissions
  SELECT ump.machine_id FROM user_machine_permissions ump
  JOIN machines m ON m.id = ump.machine_id AND m.is_active = true
  WHERE ump.user_id = auth.uid()

  UNION

  -- Staff: group-based machine permissions
  SELECT gpgm.machine_id 
  FROM user_permission_groups upg
  JOIN machine_permission_group_machines gpgm ON gpgm.group_id = upg.group_id
  JOIN machines m ON m.id = gpgm.machine_id AND m.is_active = true
  WHERE upg.user_id = auth.uid()
$$;
