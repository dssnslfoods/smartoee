
-- Add company_id to downtime_reasons
ALTER TABLE public.downtime_reasons ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Add company_id to defect_reasons  
ALTER TABLE public.defect_reasons ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Create indexes
CREATE INDEX idx_downtime_reasons_company ON public.downtime_reasons(company_id);
CREATE INDEX idx_defect_reasons_company ON public.defect_reasons(company_id);

-- Drop old RLS policies for downtime_reasons
DROP POLICY IF EXISTS "Admins can manage downtime reasons" ON public.downtime_reasons;
DROP POLICY IF EXISTS "Authenticated users can view downtime reasons" ON public.downtime_reasons;

-- New RLS policies for downtime_reasons (company-scoped)
CREATE POLICY "Admins can manage downtime reasons"
ON public.downtime_reasons FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage downtime reasons in their company"
ON public.downtime_reasons FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view downtime reasons in their company"
ON public.downtime_reasons FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_admin(auth.uid()));

-- Drop old RLS policies for defect_reasons
DROP POLICY IF EXISTS "Admins can manage defect reasons" ON public.defect_reasons;
DROP POLICY IF EXISTS "Authenticated users can view defect reasons" ON public.defect_reasons;

-- New RLS policies for defect_reasons (company-scoped)
CREATE POLICY "Admins can manage defect reasons"
ON public.defect_reasons FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage defect reasons in their company"
ON public.defect_reasons FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view defect reasons in their company"
ON public.defect_reasons FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_admin(auth.uid()));
