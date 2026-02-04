
-- Add shift_calendar_id to oee_snapshots for proper shift-level tracking
ALTER TABLE public.oee_snapshots 
ADD COLUMN IF NOT EXISTS shift_calendar_id UUID REFERENCES public.shift_calendar(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_oee_snapshots_shift_calendar_id 
ON public.oee_snapshots(shift_calendar_id);

-- Update the unique constraint to include shift_calendar_id
-- First drop existing constraint if any
DROP INDEX IF EXISTS oee_snapshots_scope_scope_id_period_period_start_key;

-- Create new unique constraint including shift_calendar_id
CREATE UNIQUE INDEX IF NOT EXISTS oee_snapshots_unique_machine_shift
ON public.oee_snapshots(scope, scope_id, period, shift_calendar_id)
WHERE shift_calendar_id IS NOT NULL;

-- Recreate v_shift_summary to use shift_calendar_id
DROP VIEW IF EXISTS v_shift_summary;

CREATE OR REPLACE VIEW v_shift_summary AS
SELECT 
    sc.id AS shift_calendar_id,
    sc.shift_date,
    s.name AS shift_name,
    p.id AS plant_id,
    p.name AS plant_name,
    sc.planned_time_minutes,
    COALESCE(sa.status, 'DRAFT'::approval_status) AS approval_status,
    sa.approved_by,
    sa.approved_at,
    sa.locked_by,
    sa.locked_at,
    -- Aggregate OEE metrics from machine-level snapshots for THIS shift
    COALESCE(machine_stats.avg_availability, 0) AS avg_availability,
    COALESCE(machine_stats.avg_performance, 0) AS avg_performance,
    COALESCE(machine_stats.avg_quality, 0) AS avg_quality,
    COALESCE(machine_stats.avg_oee, 0) AS avg_oee,
    COALESCE(machine_stats.total_run_time, 0) AS total_run_time,
    COALESCE(machine_stats.total_downtime, 0) AS total_downtime,
    COALESCE(machine_stats.total_good_qty, 0) AS total_good_qty,
    COALESCE(machine_stats.total_reject_qty, 0) AS total_reject_qty,
    (
        SELECT count(*) 
        FROM machines m
        JOIN lines l ON m.line_id = l.id
        WHERE l.plant_id = p.id AND m.is_active = true
    ) AS machine_count
FROM shift_calendar sc
JOIN shifts s ON sc.shift_id = s.id
JOIN plants p ON sc.plant_id = p.id
LEFT JOIN shift_approvals sa ON sc.id = sa.shift_calendar_id
LEFT JOIN LATERAL (
    SELECT 
        AVG(os.availability)::numeric(5,2) AS avg_availability,
        AVG(os.performance)::numeric(5,2) AS avg_performance,
        AVG(os.quality)::numeric(5,2) AS avg_quality,
        AVG(os.oee)::numeric(5,2) AS avg_oee,
        SUM(os.run_time_minutes)::bigint AS total_run_time,
        SUM(os.downtime_minutes)::bigint AS total_downtime,
        SUM(os.good_qty)::bigint AS total_good_qty,
        SUM(os.reject_qty)::bigint AS total_reject_qty
    FROM oee_snapshots os
    WHERE os.scope = 'MACHINE'
      AND os.period = 'SHIFT'
      AND os.shift_calendar_id = sc.id
) machine_stats ON true;
