-- ========================================================================================
-- 03_functions.sql - App Functions, Triggers & Seed Data
-- Generated automatically for Supabase Migration
-- ========================================================================================

-- === 1. AUDIT LOG TRIGGER ===============================================================

CREATE OR REPLACE FUNCTION public.audit_trail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Apply Audit Log to important master tables
DO $$ DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'companies', 'plants', 'lines', 'machines', 'products', 
        'user_profiles', 'defect_reasons', 'downtime_reasons', 'setup_reasons', 'shift_approvals'
    ])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%s;', t, t);
        EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.audit_trail();', t, t);
    END LOOP;
END $$;


-- === 2. AUTO-CREATE USER PROFILE ON SIGNUP ==============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, role, company_id, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::public.app_role,
            'STAFF'::public.app_role
        ),
        (NEW.raw_user_meta_data->>'company_id')::uuid,
        NEW.email
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- === 3. OEE CALCULATION LOGIC ===========================================================

CREATE OR REPLACE FUNCTION public.calculate_oee(p_shift_calendar_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_planned_time_minutes INT;
    v_run_time_minutes INT;
    v_downtime_minutes INT;
    v_good_qty INT;
    v_reject_qty INT;
    v_ideal_cycle_time NUMERIC;
    v_availability NUMERIC;
    v_performance NUMERIC;
    v_quality NUMERIC;
    v_oee NUMERIC;
    machine_record RECORD;
    v_shift_start TIMESTAMPTZ;
    v_shift_end TIMESTAMPTZ;
BEGIN
    -- This function calculates OEE for a specific shift and upserts snapshot per machine
    SELECT planned_time_minutes INTO v_planned_time_minutes
    FROM public.shift_calendar WHERE id = p_shift_calendar_id;

    -- Infer period bounds based on shift date
    SELECT shift_date::TIMESTAMPTZ, (shift_date + interval '1 day')::TIMESTAMPTZ 
    INTO v_shift_start, v_shift_end
    FROM public.shift_calendar WHERE id = p_shift_calendar_id;

    FOR machine_record IN 
        SELECT DISTINCT machine_id FROM public.production_counts WHERE shift_calendar_id = p_shift_calendar_id
        UNION
        SELECT DISTINCT machine_id FROM public.production_events WHERE shift_calendar_id = p_shift_calendar_id
    LOOP
        -- Downtime (sum of DOWNTIME events)
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_ts - start_ts))/60), 0) INTO v_downtime_minutes
        FROM public.production_events 
        WHERE shift_calendar_id = p_shift_calendar_id AND machine_id = machine_record.machine_id 
          AND event_type = 'DOWNTIME' AND end_ts IS NOT NULL;

        v_run_time_minutes := v_planned_time_minutes - v_downtime_minutes;
        IF v_run_time_minutes < 0 THEN v_run_time_minutes := 0; END IF;

        -- Counts
        SELECT COALESCE(SUM(good_qty), 0), COALESCE(SUM(reject_qty), 0) INTO v_good_qty, v_reject_qty
        FROM public.production_counts 
        WHERE shift_calendar_id = p_shift_calendar_id AND machine_id = machine_record.machine_id;

        -- Ideal cycle time
        SELECT ideal_cycle_time_seconds INTO v_ideal_cycle_time
        FROM public.machines WHERE id = machine_record.machine_id;

        -- Availability
        IF v_planned_time_minutes > 0 THEN
            v_availability := (v_run_time_minutes::NUMERIC / v_planned_time_minutes::NUMERIC) * 100;
        ELSE
            v_availability := 0;
        END IF;

        -- Performance
        IF v_run_time_minutes > 0 THEN
            v_performance := (((v_good_qty + v_reject_qty) * (v_ideal_cycle_time / 60)) / v_run_time_minutes) * 100;
        ELSE
            v_performance := 0;
        END IF;

        -- Quality
        IF (v_good_qty + v_reject_qty) > 0 THEN
            v_quality := (v_good_qty::NUMERIC / (v_good_qty + v_reject_qty)::NUMERIC) * 100;
        ELSE
            v_quality := 0;
        END IF;

        -- Cap at 100%
        IF v_availability > 100 THEN v_availability := 100; END IF;
        IF v_performance > 100 THEN v_performance := 100; END IF;
        IF v_quality > 100 THEN v_quality := 100; END IF;

        v_oee := (v_availability * v_performance * v_quality) / 10000;

        -- Upsert snapshot (since shift period is unique)
        DELETE FROM public.oee_snapshots 
        WHERE shift_calendar_id = p_shift_calendar_id AND scope_id = machine_record.machine_id AND scope = 'MACHINE';

        INSERT INTO public.oee_snapshots (
            scope, scope_id, period, period_start, period_end,
            availability, performance, quality, oee,
            run_time_minutes, downtime_minutes, planned_time_minutes,
            good_qty, reject_qty, shift_calendar_id
        )
        VALUES (
            'MACHINE', machine_record.machine_id, 'SHIFT', v_shift_start, v_shift_end,
            v_availability, v_performance, v_quality, v_oee,
            v_run_time_minutes, v_downtime_minutes, v_planned_time_minutes,
            v_good_qty, v_reject_qty, p_shift_calendar_id
        );
    END LOOP;
END;
$$;


-- === 4. SEED DATA =======================================================================

-- Downtime Reasons
INSERT INTO public.downtime_reasons (code, name, category, is_active) VALUES
('DT001', 'Breakdown', 'UNPLANNED', true),
('DT002', 'Material Shortage', 'UNPLANNED', true),
('DT003', 'Changeover', 'PLANNED', true),
('DT004', 'Cleaning', 'PLANNED', true),
('DT005', 'Minor Stop', 'PERFORMANCE_LOSS', true)
ON CONFLICT (code) DO NOTHING;

-- Defect Reasons
INSERT INTO public.defect_reasons (code, name, is_active) VALUES
('DF001', 'Scratch', true),
('DF002', 'Wrong Dimension', true),
('DF003', 'Color Mismatch', true),
('DF004', 'Assembly Error', true)
ON CONFLICT (code) DO NOTHING;

-- Setup Reasons
INSERT INTO public.setup_reasons (code, name, is_active) VALUES
('SU001', 'Initial Setup', true),
('SU002', 'Tool Change', true),
('SU003', 'Calibration', true)
ON CONFLICT DO NOTHING;
