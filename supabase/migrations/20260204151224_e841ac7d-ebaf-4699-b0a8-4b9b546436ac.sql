-- Make company_id required for new users
-- Note: This will only affect new inserts, existing NULL values will remain

-- First, let's add a check constraint that will be enforced on new inserts
-- We use a trigger instead of NOT NULL to allow existing data
CREATE OR REPLACE FUNCTION public.check_company_required()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'Company is required for new users';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to enforce company requirement on insert
CREATE TRIGGER enforce_company_on_insert
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_company_required();