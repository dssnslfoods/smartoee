-- Create helper function to check if user is supervisor of a company
CREATE OR REPLACE FUNCTION public.is_supervisor_of_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = _user_id 
          AND role IN ('SUPERVISOR', 'ADMIN')
          AND (company_id = _company_id OR public.is_admin(_user_id))
    )
$$;

-- Create helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT company_id FROM public.user_profiles WHERE user_id = _user_id
$$;

-- Drop existing restrictive policies for plants
DROP POLICY IF EXISTS "Admins can manage plants" ON public.plants;

-- Create new policies for plants: Admin OR Supervisor of same company
CREATE POLICY "Admins and supervisors can manage plants"
ON public.plants
FOR ALL
USING (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
)
WITH CHECK (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
);

-- Drop existing restrictive policies for lines
DROP POLICY IF EXISTS "Admins can manage lines" ON public.lines;

-- Create new policies for lines: Admin OR Supervisor of same company
CREATE POLICY "Admins and supervisors can manage lines"
ON public.lines
FOR ALL
USING (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
)
WITH CHECK (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
);

-- Drop existing restrictive policies for machines
DROP POLICY IF EXISTS "Admins can manage machines" ON public.machines;

-- Create new policies for machines: Admin OR Supervisor of same company
CREATE POLICY "Admins and supervisors can manage machines"
ON public.machines
FOR ALL
USING (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
)
WITH CHECK (
    public.is_admin(auth.uid()) OR 
    public.is_supervisor_of_company(auth.uid(), company_id)
);

-- Drop existing admin-only policies for user_profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;

-- Create new policy: Admin can manage all, Supervisor can create/update STAFF in their company only
CREATE POLICY "Admins can manage all profiles"
ON public.user_profiles
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Supervisors can view staff in their company
CREATE POLICY "Supervisors can view staff in their company"
ON public.user_profiles
FOR SELECT
USING (
    public.is_supervisor(auth.uid()) AND 
    company_id = public.get_user_company(auth.uid())
);

-- Supervisors can insert STAFF users in their company only
CREATE POLICY "Supervisors can create staff in their company"
ON public.user_profiles
FOR INSERT
WITH CHECK (
    public.is_supervisor(auth.uid()) AND 
    role = 'STAFF' AND
    company_id = public.get_user_company(auth.uid())
);

-- Supervisors can update STAFF users in their company only
CREATE POLICY "Supervisors can update staff in their company"
ON public.user_profiles
FOR UPDATE
USING (
    public.is_supervisor(auth.uid()) AND 
    role = 'STAFF' AND
    company_id = public.get_user_company(auth.uid())
)
WITH CHECK (
    public.is_supervisor(auth.uid()) AND 
    role = 'STAFF' AND
    company_id = public.get_user_company(auth.uid())
);

-- Supervisors can delete STAFF users in their company only
CREATE POLICY "Supervisors can delete staff in their company"
ON public.user_profiles
FOR DELETE
USING (
    public.is_supervisor(auth.uid()) AND 
    role = 'STAFF' AND
    company_id = public.get_user_company(auth.uid())
);