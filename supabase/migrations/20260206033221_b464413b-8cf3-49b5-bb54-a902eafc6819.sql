
-- Create products (SKU) table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ideal_cycle_time_seconds NUMERIC NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on code per company
ALTER TABLE public.products ADD CONSTRAINT products_company_code_unique UNIQUE (company_id, code);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
CREATE POLICY "Admins can manage products"
ON public.products FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage products in their company"
ON public.products FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view products in their company"
ON public.products FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_admin(auth.uid()));

-- Add product_id to production_events (nullable for backward compatibility)
ALTER TABLE public.production_events
ADD COLUMN product_id UUID REFERENCES public.products(id);

-- Create index for efficient lookup
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_production_events_product_id ON public.production_events(product_id);

-- Add updated_at trigger
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update rpc_start_event to accept product_id
CREATE OR REPLACE FUNCTION public.rpc_start_event(
  p_machine_id uuid, 
  p_event_type event_type, 
  p_reason_id uuid DEFAULT NULL::uuid, 
  p_notes text DEFAULT NULL::text,
  p_product_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_shift_calendar_id UUID;
    v_machine RECORD;
    v_event_id UUID;
    v_is_locked BOOLEAN;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'User not authenticated');
    END IF;

    -- Check machine permission
    IF NOT public.has_machine_permission(v_user_id, p_machine_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'No permission for this machine');
    END IF;

    -- Get machine info
    SELECT m.*, l.plant_id INTO v_machine
    FROM public.machines m
    JOIN public.lines l ON m.line_id = l.id
    WHERE m.id = p_machine_id AND m.is_active = true;

    IF v_machine IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Machine not found or inactive');
    END IF;

    -- Get current shift calendar
    SELECT sc.id INTO v_shift_calendar_id
    FROM public.shift_calendar sc
    JOIN public.shifts s ON sc.shift_id = s.id
    WHERE sc.plant_id = v_machine.plant_id
      AND sc.shift_date = CURRENT_DATE
      AND CURRENT_TIME BETWEEN s.start_time AND s.end_time
    LIMIT 1;

    -- If no shift found for current time, get any shift for today
    IF v_shift_calendar_id IS NULL THEN
        SELECT sc.id INTO v_shift_calendar_id
        FROM public.shift_calendar sc
        WHERE sc.plant_id = v_machine.plant_id
          AND sc.shift_date = CURRENT_DATE
        ORDER BY sc.shift_id
        LIMIT 1;
    END IF;

    IF v_shift_calendar_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'No shift calendar found for today');
    END IF;

    -- Check if shift is locked
    v_is_locked := public.is_shift_locked(v_shift_calendar_id);
    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', 'Shift is locked, cannot add events');
    END IF;

    -- Validate reason_id for DOWNTIME/SETUP
    IF p_event_type IN ('DOWNTIME', 'SETUP') AND p_reason_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'Reason is required for DOWNTIME/SETUP events');
    END IF;

    -- Close any open events for this machine
    UPDATE public.production_events
    SET end_ts = now(), updated_at = now()
    WHERE machine_id = p_machine_id
      AND shift_calendar_id = v_shift_calendar_id
      AND end_ts IS NULL;

    -- Insert new event with product_id
    INSERT INTO public.production_events (
        plant_id, line_id, machine_id, shift_calendar_id,
        event_type, reason_id, product_id, start_ts, notes, created_by
    ) VALUES (
        v_machine.plant_id, v_machine.line_id, p_machine_id, v_shift_calendar_id,
        p_event_type, p_reason_id, p_product_id, now(), p_notes, v_user_id
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'message', 'Event started successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE 'OVERLAP_EVENT%' THEN
            RETURN jsonb_build_object('success', false, 'error', 'OVERLAP_EVENT', 'message', SQLERRM);
        ELSIF SQLERRM LIKE 'SHIFT_LOCKED%' THEN
            RETURN jsonb_build_object('success', false, 'error', 'SHIFT_LOCKED', 'message', SQLERRM);
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', SQLERRM);
        END IF;
END;
$function$;
