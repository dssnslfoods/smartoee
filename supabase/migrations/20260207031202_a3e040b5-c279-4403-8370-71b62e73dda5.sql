
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Admin & Supervisor can view ALL audit logs
CREATE POLICY "Admin and Supervisor can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.is_supervisor(auth.uid())
);

-- Staff can view only their own audit logs
CREATE POLICY "Staff can view own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  actor_user_id = auth.uid()
);
