-- Drop the trigger and function with CASCADE
DROP TRIGGER IF EXISTS enforce_company_on_insert ON public.user_profiles;
DROP FUNCTION IF EXISTS public.check_company_required() CASCADE;

-- Update handle_new_user to accept company_id and role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_id UUID;
    v_role app_role;
BEGIN
    -- Try to get company_id and role from user metadata (if provided during signup)
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'STAFF');
    
    INSERT INTO public.user_profiles (user_id, full_name, role, company_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        v_role,
        v_company_id
    );
    RETURN NEW;
END;
$$;

-- Add a constraint that checks company_id is NOT NULL except for ADMINs
-- ADMINs can have null company_id since they manage all companies
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_company_required;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_company_required 
CHECK (
    company_id IS NOT NULL OR role = 'ADMIN'
);