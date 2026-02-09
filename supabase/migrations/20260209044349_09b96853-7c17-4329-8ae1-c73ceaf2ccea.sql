-- Drop the existing admin-only policy and replace with one that includes Supervisors
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;

-- Admin: full access to all shifts
CREATE POLICY "Admins can manage shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Supervisor: full access to manage shifts
CREATE POLICY "Supervisors can manage shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'SUPERVISOR')
WITH CHECK (public.get_user_role(auth.uid()) = 'SUPERVISOR');