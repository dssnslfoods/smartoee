
-- Create setup_reasons table
CREATE TABLE public.setup_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique constraint on code per company
CREATE UNIQUE INDEX idx_setup_reasons_code_company ON public.setup_reasons (code, company_id);

-- Enable RLS
ALTER TABLE public.setup_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage setup reasons"
ON public.setup_reasons
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage setup reasons in their company"
ON public.setup_reasons
FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view setup reasons in their company"
ON public.setup_reasons
FOR SELECT
USING ((company_id = get_user_company(auth.uid())) OR is_admin(auth.uid()));
