-- =============================================
-- OEE BUSINESS RULES ENFORCEMENT (TRIGGERS)
-- =============================================

-- 1. AUDIT LOG TABLE
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    before_json JSONB,
    after_json JSONB,
    actor_user_id UUID,
    ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_ts ON public.audit_logs(ts);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);

-- RLS for audit logs (admin only read, system write)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- =============================================
-- 2. OVERLAP PREVENTION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.check_event_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    -- Check for overlapping events on same machine and shift
    SELECT COUNT(*) INTO overlap_count
    FROM public.production_events pe
    WHERE pe.machine_id = NEW.machine_id
      AND pe.shift_calendar_id = NEW.shift_calendar_id
      AND pe.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
          -- Case 1: New event starts during existing event
          (NEW.start_ts >= pe.start_ts AND NEW.start_ts < COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          -- Case 2: New event ends during existing event
          (COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) > pe.start_ts 
           AND COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) <= COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          -- Case 3: New event completely contains existing event
          (NEW.start_ts <= pe.start_ts 
           AND COALESCE(NEW.end_ts, 'infinity'::TIMESTAMPTZ) >= COALESCE(pe.end_ts, 'infinity'::TIMESTAMPTZ))
          OR
          -- Case 4: Both events are open-ended (no end_ts)
          (NEW.end_ts IS NULL AND pe.end_ts IS NULL)
      );

    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'OVERLAP_EVENT: Cannot create overlapping events on the same machine within the same shift'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

-- =============================================
-- 3. LOCK ENFORCEMENT FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.check_shift_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    shift_status public.approval_status;
    shift_cal_id UUID;
BEGIN
    -- Get the shift_calendar_id depending on operation
    IF TG_OP = 'DELETE' THEN
        shift_cal_id := OLD.shift_calendar_id;
    ELSE
        shift_cal_id := NEW.shift_calendar_id;
    END IF;

    -- Check if shift is locked
    SELECT status INTO shift_status
    FROM public.shift_approvals
    WHERE shift_calendar_id = shift_cal_id;

    IF shift_status = 'LOCKED' THEN
        RAISE EXCEPTION 'SHIFT_LOCKED: Cannot modify data for a locked shift'
            USING ERRCODE = 'P0002';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- =============================================
-- 4. AUDIT TRAIL FUNCTION
-- =============================================

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
    -- Determine entity_id and before/after values based on operation
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

    -- Insert audit log entry
    INSERT INTO public.audit_logs (
        entity_type,
        entity_id,
        action,
        before_json,
        after_json,
        actor_user_id
    ) VALUES (
        TG_TABLE_NAME,
        entity_id_val,
        TG_OP,
        before_val,
        after_val,
        auth.uid()
    );

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- =============================================
-- 5. APPLY TRIGGERS TO PRODUCTION_EVENTS
-- =============================================

-- Overlap prevention (BEFORE INSERT/UPDATE)
CREATE TRIGGER trg_production_events_overlap
    BEFORE INSERT OR UPDATE ON public.production_events
    FOR EACH ROW
    EXECUTE FUNCTION public.check_event_overlap();

-- Lock enforcement (BEFORE INSERT/UPDATE/DELETE)
CREATE TRIGGER trg_production_events_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.production_events
    FOR EACH ROW
    EXECUTE FUNCTION public.check_shift_lock();

-- Audit trail (AFTER INSERT/UPDATE/DELETE)
CREATE TRIGGER trg_production_events_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.production_events
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- =============================================
-- 6. APPLY TRIGGERS TO PRODUCTION_COUNTS
-- =============================================

-- Lock enforcement (BEFORE INSERT/UPDATE/DELETE)
CREATE TRIGGER trg_production_counts_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.production_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.check_shift_lock();

-- Audit trail (AFTER INSERT/UPDATE/DELETE)
CREATE TRIGGER trg_production_counts_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.production_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- =============================================
-- 7. APPLY AUDIT TRAIL TO OTHER CRITICAL TABLES
-- =============================================

-- Shift Approvals audit
CREATE TRIGGER trg_shift_approvals_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.shift_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- Machines audit
CREATE TRIGGER trg_machines_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.machines
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- Lines audit
CREATE TRIGGER trg_lines_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.lines
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- Plants audit
CREATE TRIGGER trg_plants_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.plants
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- User profiles audit
CREATE TRIGGER trg_user_profiles_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trail();

-- =============================================
-- 8. HELPER VIEW FOR AUDIT LOGS
-- =============================================

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