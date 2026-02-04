-- Update has_plant_permission to automatically grant access to supervisors for plants in their company
CREATE OR REPLACE FUNCTION public.has_plant_permission(_user_id UUID, _plant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Admin has access to all plants
        public.is_admin(_user_id)
        OR
        -- User has explicit plant permission
        EXISTS (
            SELECT 1 FROM public.user_plant_permissions 
            WHERE user_id = _user_id AND plant_id = _plant_id
        )
        OR
        -- Supervisor has automatic access to all plants in their company
        EXISTS (
            SELECT 1 
            FROM public.user_profiles up
            JOIN public.plants p ON p.company_id = up.company_id
            WHERE up.user_id = _user_id 
              AND up.role IN ('SUPERVISOR', 'EXECUTIVE')
              AND p.id = _plant_id
        )
$$;