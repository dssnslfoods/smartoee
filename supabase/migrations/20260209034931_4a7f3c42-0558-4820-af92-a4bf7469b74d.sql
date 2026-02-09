-- =============================================
-- Fix RLS: Allow Supervisors to manage plant & line permissions for STAFF in their company
-- Also allow Supervisors to VIEW permissions of staff in their company
-- =============================================

-- 1. user_plant_permissions: Add Supervisor management policy
CREATE POLICY "Supervisors can manage plant permissions in their company"
ON public.user_plant_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_plant_permissions.user_id
      AND staff_profile.role = 'STAFF'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    JOIN plants p ON p.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_plant_permissions.user_id
      AND staff_profile.role = 'STAFF'
      AND p.id = user_plant_permissions.plant_id
  )
);

-- 2. user_line_permissions: Add Supervisor management policy
CREATE POLICY "Supervisors can manage line permissions in their company"
ON public.user_line_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_line_permissions.user_id
      AND staff_profile.role = 'STAFF'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    JOIN lines l ON l.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_line_permissions.user_id
      AND staff_profile.role = 'STAFF'
      AND l.id = user_line_permissions.line_id
  )
);

-- 3. Allow Supervisors to view permissions of staff in their company (not just own)
CREATE POLICY "Supervisors can view plant permissions of staff in company"
ON public.user_plant_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_plant_permissions.user_id
  )
);

CREATE POLICY "Supervisors can view line permissions of staff in company"
ON public.user_line_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_line_permissions.user_id
  )
);

CREATE POLICY "Supervisors can view machine permissions of staff in company"
ON public.user_machine_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles supervisor_profile
    JOIN user_profiles staff_profile ON staff_profile.company_id = supervisor_profile.company_id
    WHERE supervisor_profile.user_id = auth.uid()
      AND supervisor_profile.role = 'SUPERVISOR'
      AND staff_profile.user_id = user_machine_permissions.user_id
  )
);