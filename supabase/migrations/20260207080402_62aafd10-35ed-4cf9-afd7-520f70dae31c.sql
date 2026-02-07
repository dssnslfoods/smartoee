
-- Add email column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing profiles with email from auth.users
UPDATE public.user_profiles
SET email = u.email
FROM auth.users u
WHERE user_profiles.user_id = u.id;

-- Update the handle_new_user trigger to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, role, company_id, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::app_role,
            'STAFF'::app_role
        ),
        (NEW.raw_user_meta_data->>'company_id')::uuid,
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
