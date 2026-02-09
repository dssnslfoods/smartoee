-- Add Supervisor write access to shift_calendar for plants in their company
CREATE POLICY "Supervisors can manage shift_calendar in their company"
ON public.shift_calendar
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.plants p ON p.company_id = up.company_id
    WHERE up.user_id = auth.uid()
      AND up.role = 'SUPERVISOR'
      AND p.id = shift_calendar.plant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.plants p ON p.company_id = up.company_id
    WHERE up.user_id = auth.uid()
      AND up.role = 'SUPERVISOR'
      AND p.id = shift_calendar.plant_id
  )
);