-- =============================================
-- FIX AUDIT LOG
-- Fixes RLS policies, ensures triggers exist,
-- and recreates the readable view.
-- =============================================

-- Step 1: Fix RLS policies for audit_logs table
-- Drop old/conflicting policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admin and Supervisor can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can view own audit logs" ON public.audit_logs;

-- Allow Supervisor and Admin to read ALL audit logs
CREATE POLICY "Supervisors and Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    public.is_supervisor(_user_id := auth.uid())
);

-- Staff can see their own audit logs
CREATE POLICY "Staff can view own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    actor_user_id = auth.uid()
);

-- Step 2: Allow the system (SECURITY DEFINER functions) to INSERT into audit_logs
-- The audit_trail trigger runs as a SECURITY DEFINER function which doesn't need RLS
-- but we need to ensure INSERT is possible
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 3: Ensure audit_trail trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entity_id_val UUID;
    before_val JSONB;
    after_val JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        entity_id_val := NEW.id;
        before_val := NULL;
        after_val := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        entity_id_val := NEW.id;
        before_val := to_jsonb(OLD);
        after_val := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        entity_id_val := OLD.id;
        before_val := to_jsonb(OLD);
        after_val := NULL;
    END IF;

    INSERT INTO public.audit_logs (
        entity_type, entity_id, action,
        before_json, after_json, actor_user_id
    ) VALUES (
        TG_TABLE_NAME, entity_id_val, TG_OP,
        before_val, after_val, auth.uid()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Step 4: Ensure triggers exist on key tables (safe to create with OR REPLACE)
-- Production Events
DROP TRIGGER IF EXISTS trg_production_events_audit ON public.production_events;
CREATE TRIGGER trg_production_events_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.production_events
    FOR EACH ROW EXECUTE FUNCTION public.audit_trail();

-- Production Counts
DROP TRIGGER IF EXISTS trg_production_counts_audit ON public.production_counts;
CREATE TRIGGER trg_production_counts_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.production_counts
    FOR EACH ROW EXECUTE FUNCTION public.audit_trail();

-- Shift Approvals
DROP TRIGGER IF EXISTS trg_shift_approvals_audit ON public.shift_approvals;
CREATE TRIGGER trg_shift_approvals_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.shift_approvals
    FOR EACH ROW EXECUTE FUNCTION public.audit_trail();

-- Machines
DROP TRIGGER IF EXISTS trg_machines_audit ON public.machines;
CREATE TRIGGER trg_machines_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.machines
    FOR EACH ROW EXECUTE FUNCTION public.audit_trail();

-- User Profiles
DROP TRIGGER IF EXISTS trg_user_profiles_audit ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trail();

-- Step 5: Recreate the readable view with security_definer to bypass RLS
-- This way we control access at the view-level via the policy on the underlying table
DROP VIEW IF EXISTS public.v_audit_logs_readable;

CREATE OR REPLACE VIEW public.v_audit_logs_readable
WITH (security_invoker = on)
AS
SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.action,
    al.before_json,
    al.after_json,
    al.actor_user_id,
    up.full_name AS actor_name,
    al.ts
FROM public.audit_logs al
LEFT JOIN public.user_profiles up ON al.actor_user_id = up.user_id
ORDER BY al.ts DESC;

-- Grant access to view
GRANT SELECT ON public.v_audit_logs_readable TO authenticated;
