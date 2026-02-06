
-- =============================================
-- 1. Create production_standards table (Machine <-> SKU junction)
-- =============================================
CREATE TABLE public.production_standards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id UUID NOT NULL,
    product_id UUID NOT NULL,
    company_id UUID NOT NULL,
    ideal_cycle_time_seconds NUMERIC NOT NULL DEFAULT 60,
    std_setup_time_seconds NUMERIC NOT NULL DEFAULT 0,
    target_quality NUMERIC(5,2) NOT NULL DEFAULT 99.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(machine_id, product_id)
);

-- Enable RLS
ALTER TABLE public.production_standards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage production_standards"
ON public.production_standards FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage production_standards in their company"
ON public.production_standards FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view production_standards in their company"
ON public.production_standards FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_production_standards_updated_at
BEFORE UPDATE ON public.production_standards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail trigger
CREATE TRIGGER audit_production_standards
AFTER INSERT OR UPDATE OR DELETE ON public.production_standards
FOR EACH ROW
EXECUTE FUNCTION public.audit_trail();

-- =============================================
-- 2. Update rpc_recalc_oee_for_shift to use production_standards
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_recalc_oee_for_shift(p_shift_calendar_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_shift RECORD;
    v_machine RECORD;
    v_run_time INTEGER;
    v_downtime INTEGER;
    v_planned_time INTEGER;
    v_good_qty INTEGER;
    v_reject_qty INTEGER;
    v_availability NUMERIC(5,2);
    v_performance NUMERIC(5,2);
    v_quality NUMERIC(5,2);
    v_oee NUMERIC(5,2);
    v_ideal_cycle_time NUMERIC;
    v_machines_processed INTEGER := 0;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Only supervisors and admins can recalculate
    IF NOT public.is_supervisor(v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Only supervisors can recalculate OEE');
    END IF;

    -- Get shift info
    SELECT sc.*, s.start_time, s.end_time, s.name as shift_name
    INTO v_shift
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.id = p_shift_calendar_id;

    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Shift calendar not found');
    END IF;

    v_planned_time := v_shift.planned_time_minutes;

    -- Process each machine in this plant
    FOR v_machine IN
        SELECT m.*
        FROM public.machines m
        JOIN public.lines l ON m.line_id = l.id
        WHERE l.plant_id = v_shift.plant_id AND m.is_active = true
    LOOP
        -- Calculate weighted ideal cycle time from production_standards
        -- Priority: production_standards > product.ideal_cycle_time_seconds > machine.ideal_cycle_time_seconds
        SELECT 
            COALESCE(
                SUM(
                    COALESCE(
                        ps.ideal_cycle_time_seconds,            -- 1st: production_standards (machine+SKU specific)
                        p.ideal_cycle_time_seconds,              -- 2nd: product default
                        v_machine.ideal_cycle_time_seconds       -- 3rd: machine default
                    ) *
                    EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))
                ) / NULLIF(SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts))), 0),
                v_machine.ideal_cycle_time_seconds
            )
        INTO v_ideal_cycle_time
        FROM public.production_events pe
        LEFT JOIN public.products p ON pe.product_id = p.id
        LEFT JOIN public.production_standards ps 
            ON ps.machine_id = v_machine.id 
            AND ps.product_id = pe.product_id 
            AND ps.is_active = true
        WHERE pe.machine_id = v_machine.id
          AND pe.shift_calendar_id = p_shift_calendar_id
          AND pe.event_type = 'RUN';

        -- Fallback to machine cycle time if no RUN events at all
        IF v_ideal_cycle_time IS NULL OR v_ideal_cycle_time <= 0 THEN
            v_ideal_cycle_time := v_machine.ideal_cycle_time_seconds;
        END IF;

        -- Calculate run time (RUN events only) for THIS specific shift
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_run_time
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type = 'RUN';

        -- Calculate downtime (DOWNTIME + SETUP events)
        SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(end_ts, now()) - start_ts)) / 60
        ), 0)::INTEGER
        INTO v_downtime
        FROM public.production_events
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id
          AND event_type IN ('DOWNTIME', 'SETUP');

        -- Get production counts
        SELECT 
            COALESCE(SUM(good_qty), 0),
            COALESCE(SUM(reject_qty), 0)
        INTO v_good_qty, v_reject_qty
        FROM public.production_counts
        WHERE machine_id = v_machine.id
          AND shift_calendar_id = p_shift_calendar_id;

        -- Calculate OEE components
        IF v_planned_time > 0 THEN
            v_availability := LEAST((v_run_time::NUMERIC / v_planned_time) * 100, 100);
        ELSE
            v_availability := 0;
        END IF;

        IF v_run_time > 0 AND v_ideal_cycle_time > 0 THEN
            v_performance := LEAST(
                ((v_good_qty + v_reject_qty) * (v_ideal_cycle_time / 60)::NUMERIC / v_run_time) * 100,
                100
            );
        ELSE
            v_performance := 0;
        END IF;

        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)) * 100;
        ELSE
            v_quality := 100;
        END IF;

        v_oee := (v_availability * v_performance * v_quality) / 10000;

        -- Delete existing snapshot for this machine and shift
        DELETE FROM public.oee_snapshots 
        WHERE scope = 'MACHINE' 
          AND scope_id = v_machine.id 
          AND period = 'SHIFT'
          AND shift_calendar_id = p_shift_calendar_id;

        -- Insert new OEE snapshot
        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            shift_calendar_id,
            availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty
        ) VALUES (
            'MACHINE', v_machine.id, 'SHIFT',
            (v_shift.shift_date || ' ' || v_shift.start_time)::TIMESTAMPTZ,
            (v_shift.shift_date || ' ' || v_shift.end_time)::TIMESTAMPTZ,
            p_shift_calendar_id,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time, v_downtime, v_planned_time,
            v_good_qty, v_reject_qty
        );

        v_machines_processed := v_machines_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'shift_calendar_id', p_shift_calendar_id,
        'machines_processed', v_machines_processed,
        'message', 'OEE recalculated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
END;
$function$;
