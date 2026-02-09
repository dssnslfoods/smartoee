
-- Table for planned production time deduction templates (per Plant + Shift)
CREATE TABLE public.planned_time_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  plant_id UUID NOT NULL REFERENCES public.plants(id),
  shift_id UUID NOT NULL REFERENCES public.shifts(id),
  break_minutes INTEGER NOT NULL DEFAULT 0,
  meal_minutes INTEGER NOT NULL DEFAULT 0,
  meeting_minutes INTEGER NOT NULL DEFAULT 0,
  maintenance_minutes INTEGER NOT NULL DEFAULT 0,
  other_minutes INTEGER NOT NULL DEFAULT 0,
  other_label TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plant_id, shift_id)
);

-- Enable RLS
ALTER TABLE public.planned_time_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage planned_time_templates"
  ON public.planned_time_templates FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Supervisors can manage for their company
CREATE POLICY "Supervisors can manage planned_time_templates in their company"
  ON public.planned_time_templates FOR ALL
  USING (is_supervisor_of_company(auth.uid(), company_id))
  WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

-- All authenticated users can view (for OEE calculations)
CREATE POLICY "Users can view planned_time_templates in their company"
  ON public.planned_time_templates FOR SELECT
  USING ((company_id = get_user_company(auth.uid())) OR is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_planned_time_templates_updated_at
  BEFORE UPDATE ON public.planned_time_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
