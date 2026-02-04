-- Create companies table
CREATE TABLE public.companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on code
ALTER TABLE public.companies ADD CONSTRAINT companies_code_unique UNIQUE (code);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policies for companies
CREATE POLICY "Admins can manage companies"
ON public.companies FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view companies"
ON public.companies FOR SELECT
USING (true);

-- Add company_id to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create trigger for updated_at on companies
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_profiles_company_id ON public.user_profiles(company_id);