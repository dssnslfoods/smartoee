
-- Supervisor can update production_events for machines in their company (if not locked)
CREATE POLICY "Supervisor can update events in company"
ON public.production_events
FOR UPDATE
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
  AND EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.user_profiles up ON up.company_id = m.company_id
    WHERE m.id = machine_id AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
);

-- Supervisor can delete production_events for machines in their company (if not locked)
CREATE POLICY "Supervisor can delete events in company"
ON public.production_events
FOR DELETE
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
  AND EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.user_profiles up ON up.company_id = m.company_id
    WHERE m.id = machine_id AND up.user_id = auth.uid()
  )
);

-- Supervisor can update production_counts for machines in their company (if not locked)
CREATE POLICY "Supervisor can update counts in company"
ON public.production_counts
FOR UPDATE
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
  AND EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.user_profiles up ON up.company_id = m.company_id
    WHERE m.id = machine_id AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
);

-- Supervisor can delete production_counts for machines in their company (if not locked)
CREATE POLICY "Supervisor can delete counts in company"
ON public.production_counts
FOR DELETE
TO authenticated
USING (
  public.is_supervisor(auth.uid())
  AND NOT public.is_shift_locked(shift_calendar_id)
  AND EXISTS (
    SELECT 1 FROM public.machines m
    JOIN public.user_profiles up ON up.company_id = m.company_id
    WHERE m.id = machine_id AND up.user_id = auth.uid()
  )
);
