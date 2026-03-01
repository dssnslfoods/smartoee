-- ==============================================================================
-- Fix v_shift_summary View
-- Issue: Dashboard showed shifts as "No Activity" because OEE snapshots for
-- 'PLANT' scope were missing, resulting in 0 totals.
-- Solution: Aggregate production quantities and times directly from events and
-- counts tables, while still aggregating OEE from 'MACHINE' scope snapshots.
-- ==============================================================================

DROP VIEW IF EXISTS public.v_shift_summary;

CREATE OR REPLACE VIEW public.v_shift_summary
WITH (security_invoker = on)
AS
SELECT 
    sc.id AS shift_calendar_id,
    sc.shift_date,
    s.name AS shift_name,
    p.id AS plant_id,
    p.name AS plant_name,
    sc.planned_time_minutes,
    COALESCE(sa.status, 'DRAFT') AS approval_status,
    sa.approved_by,
    sa.approved_at,
    sa.locked_by,
    sa.locked_at,
    
    -- Aggregated OEE metrics from MACHINE-level snapshots
    COALESCE(AVG(os.availability), 0) AS avg_availability,
    COALESCE(AVG(os.performance), 0) AS avg_performance,
    COALESCE(AVG(os.quality), 0) AS avg_quality,
    COALESCE(AVG(os.oee), 0) AS avg_oee,
    
    -- Calculate raw times/counts directly from base tables
    COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60)::bigint
        FROM public.production_events pe 
        WHERE pe.shift_calendar_id = sc.id AND pe.event_type = 'RUN'
    ), 0) AS total_run_time,
     
    COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(pe.end_ts, now()) - pe.start_ts)) / 60)::bigint
        FROM public.production_events pe 
        WHERE pe.shift_calendar_id = sc.id AND pe.event_type IN ('DOWNTIME', 'SETUP')
    ), 0) AS total_downtime,
     
    COALESCE((
        SELECT SUM(pc.good_qty)::bigint 
        FROM public.production_counts pc 
        WHERE pc.shift_calendar_id = sc.id
    ), 0) AS total_good_qty,
     
    COALESCE((
        SELECT SUM(pc.reject_qty)::bigint 
        FROM public.production_counts pc 
        WHERE pc.shift_calendar_id = sc.id
    ), 0) AS total_reject_qty,
     
    -- Count of machines
    (SELECT COUNT(*)::bigint FROM public.machines m 
     JOIN public.lines l ON m.line_id = l.id 
     WHERE l.plant_id = p.id AND m.is_active = true) AS machine_count

FROM public.shift_calendar sc
JOIN public.shifts s ON sc.shift_id = s.id
JOIN public.plants p ON sc.plant_id = p.id
LEFT JOIN public.shift_approvals sa ON sc.id = sa.shift_calendar_id
-- Join to MACHINE scope snapshots for OEE percentages.
LEFT JOIN public.oee_snapshots os ON os.shift_calendar_id = sc.id 
    AND os.scope = 'MACHINE'
GROUP BY sc.id, sc.shift_date, s.name, p.id, p.name, 
         sc.planned_time_minutes, sa.status, sa.approved_by, 
         sa.approved_at, sa.locked_by, sa.locked_at;
