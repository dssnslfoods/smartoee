
-- Drop existing supervisor policies on user_profiles that restrict to STAFF only
DROP POLICY IF EXISTS "Supervisors can create staff in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Supervisors can update staff in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Supervisors can delete staff in their company" ON public.user_profiles;

-- Recreate policies allowing Supervisors to manage both STAFF and SUPERVISOR roles
CREATE POLICY "Supervisors can create users in their company"
ON public.user_profiles
FOR INSERT
WITH CHECK (
  is_supervisor(auth.uid())
  AND role IN ('STAFF'::app_role, 'SUPERVISOR'::app_role)
  AND company_id = get_user_company(auth.uid())
);

CREATE POLICY "Supervisors can update users in their company"
ON public.user_profiles
FOR UPDATE
USING (
  is_supervisor(auth.uid())
  AND role IN ('STAFF'::app_role, 'SUPERVISOR'::app_role)
  AND company_id = get_user_company(auth.uid())
)
WITH CHECK (
  is_supervisor(auth.uid())
  AND role IN ('STAFF'::app_role, 'SUPERVISOR'::app_role)
  AND company_id = get_user_company(auth.uid())
);

CREATE POLICY "Supervisors can delete users in their company"
ON public.user_profiles
FOR DELETE
USING (
  is_supervisor(auth.uid())
  AND role IN ('STAFF'::app_role, 'SUPERVISOR'::app_role)
  AND company_id = get_user_company(auth.uid())
);
