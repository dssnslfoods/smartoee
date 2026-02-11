
-- Step 1: Add plant_id and company_id columns (nullable first for migration)
ALTER TABLE public.shifts ADD COLUMN plant_id uuid REFERENCES public.plants(id);
ALTER TABLE public.shifts ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Step 2: Duplicate existing shifts to all active plants
DO $$
DECLARE
  v_shift RECORD;
  v_plant RECORD;
  v_new_shift_id uuid;
  v_first_assigned boolean;
BEGIN
  FOR v_shift IN SELECT * FROM shifts LOOP
    v_first_assigned := false;
    
    FOR v_plant IN SELECT id, company_id FROM plants WHERE is_active = true ORDER BY id LOOP
      IF NOT v_first_assigned THEN
        -- Assign original shift to first plant
        UPDATE shifts SET plant_id = v_plant.id, company_id = v_plant.company_id WHERE id = v_shift.id;
        v_first_assigned := true;
      ELSE
        -- Create duplicate for other plants
        INSERT INTO shifts (name, start_time, end_time, is_active, working_days, effective_from, plant_id, company_id)
        VALUES (v_shift.name, v_shift.start_time, v_shift.end_time, v_shift.is_active, v_shift.working_days, v_shift.effective_from, v_plant.id, v_plant.company_id)
        RETURNING id INTO v_new_shift_id;
        
        -- Migrate existing shift_calendar for this plant to new shift
        UPDATE shift_calendar SET shift_id = v_new_shift_id WHERE shift_id = v_shift.id AND plant_id = v_plant.id;
        
        -- Migrate planned_time_templates for this plant to new shift
        UPDATE planned_time_templates SET shift_id = v_new_shift_id WHERE shift_id = v_shift.id AND plant_id = v_plant.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 3: Make columns NOT NULL
ALTER TABLE public.shifts ALTER COLUMN plant_id SET NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN company_id SET NOT NULL;

-- Step 4: Update RLS policies
DROP POLICY IF EXISTS "Admins can manage shifts" ON public.shifts;
DROP POLICY IF EXISTS "Authenticated users can view shifts" ON public.shifts;
DROP POLICY IF EXISTS "Supervisors can manage shifts" ON public.shifts;

CREATE POLICY "Admins can manage shifts"
ON public.shifts FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Supervisors can manage shifts in their company"
ON public.shifts FOR ALL
USING (is_supervisor_of_company(auth.uid(), company_id))
WITH CHECK (is_supervisor_of_company(auth.uid(), company_id));

CREATE POLICY "Users can view shifts in their company"
ON public.shifts FOR SELECT
USING ((company_id = get_user_company(auth.uid())) OR is_admin(auth.uid()));
