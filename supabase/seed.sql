-- =============================================
-- PNF OEE System - Seed Data (CLEAN VERSION)
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- Clear existing data first (optional - comment out if you want to keep existing data)
-- DELETE FROM public.oee_snapshots;
-- DELETE FROM public.shift_calendar;
-- DELETE FROM public.defect_reasons;
-- DELETE FROM public.downtime_reasons;
-- DELETE FROM public.shifts;
-- DELETE FROM public.machines;
-- DELETE FROM public.lines;
-- DELETE FROM public.plants;

-- =============================================
-- PLANTS
-- =============================================
INSERT INTO public.plants (name, code) VALUES
    ('PNF Plant 1 - Main Factory', 'PLT-001'),
    ('PNF Plant 2 - Assembly', 'PLT-002');

-- =============================================
-- PRODUCTION LINES
-- =============================================
INSERT INTO public.lines (plant_id, name, code) 
SELECT p.id, l.name, l.code
FROM public.plants p
CROSS JOIN (
    VALUES 
        ('PLT-001', 'CNC Line 1', 'LINE-001'),
        ('PLT-001', 'CNC Line 2', 'LINE-002'),
        ('PLT-001', 'Press Line', 'LINE-003'),
        ('PLT-002', 'Assembly Line 1', 'LINE-004'),
        ('PLT-002', 'Assembly Line 2', 'LINE-005')
) AS l(plant_code, name, code)
WHERE p.code = l.plant_code;

-- =============================================
-- MACHINES
-- =============================================
INSERT INTO public.machines (line_id, name, code, ideal_cycle_time_seconds)
SELECT ln.id, m.name, m.code, m.cycle_time
FROM public.lines ln
CROSS JOIN (
    VALUES 
        ('LINE-001', 'CNC Machine 01', 'CNC-001', 45.5),
        ('LINE-001', 'CNC Machine 02', 'CNC-002', 45.5),
        ('LINE-001', 'CNC Machine 03', 'CNC-003', 60.0),
        ('LINE-002', 'CNC Machine 04', 'CNC-004', 30.0),
        ('LINE-002', 'CNC Machine 05', 'CNC-005', 30.0),
        ('LINE-003', 'Press Machine 01', 'PRS-001', 15.0),
        ('LINE-003', 'Press Machine 02', 'PRS-002', 15.0),
        ('LINE-003', 'Press Machine 03', 'PRS-003', 20.0),
        ('LINE-004', 'Assembly Station 01', 'ASM-001', 120.0),
        ('LINE-004', 'Assembly Station 02', 'ASM-002', 120.0),
        ('LINE-005', 'Assembly Station 03', 'ASM-003', 90.0),
        ('LINE-005', 'Assembly Station 04', 'ASM-004', 90.0)
) AS m(line_code, name, code, cycle_time)
WHERE ln.code = m.line_code;

-- =============================================
-- SHIFTS
-- =============================================
INSERT INTO public.shifts (name, start_time, end_time) VALUES
    ('Morning Shift', '06:00:00', '14:00:00'),
    ('Afternoon Shift', '14:00:00', '22:00:00'),
    ('Night Shift', '22:00:00', '06:00:00');

-- =============================================
-- DOWNTIME REASONS
-- =============================================
INSERT INTO public.downtime_reasons (code, name, category) VALUES
    ('DT-001', 'Scheduled Maintenance', 'PLANNED'),
    ('DT-002', 'Scheduled Break', 'PLANNED'),
    ('DT-003', 'Shift Handover', 'PLANNED'),
    ('DT-004', 'Machine Breakdown', 'BREAKDOWN'),
    ('DT-005', 'Tool Failure', 'BREAKDOWN'),
    ('DT-006', 'Material Shortage', 'UNPLANNED'),
    ('DT-007', 'Operator Absence', 'UNPLANNED'),
    ('DT-008', 'Quality Issue', 'UNPLANNED'),
    ('DT-009', 'Product Changeover', 'CHANGEOVER'),
    ('DT-010', 'Tool Changeover', 'CHANGEOVER'),
    ('DT-011', 'Setup Adjustment', 'CHANGEOVER');

-- =============================================
-- DEFECT REASONS
-- =============================================
INSERT INTO public.defect_reasons (code, name) VALUES
    ('DF-001', 'Dimensional Out of Spec'),
    ('DF-002', 'Surface Defect'),
    ('DF-003', 'Material Defect'),
    ('DF-004', 'Assembly Error'),
    ('DF-005', 'Machining Error'),
    ('DF-006', 'Coating Defect'),
    ('DF-007', 'Packaging Damage'),
    ('DF-008', 'Other');

-- =============================================
-- SHIFT CALENDAR (for next 7 days)
-- =============================================
INSERT INTO public.shift_calendar (shift_id, shift_date, plant_id, planned_time_minutes)
SELECT s.id, d.shift_date, p.id, 480
FROM public.shifts s
CROSS JOIN public.plants p
CROSS JOIN (
    SELECT CURRENT_DATE + generate_series(0, 7) AS shift_date
) d;

-- =============================================
-- SAMPLE OEE SNAPSHOTS (last 7 days)
-- =============================================
INSERT INTO public.oee_snapshots (
    scope, scope_id, period, period_start, period_end,
    availability, performance, quality, oee,
    run_time_minutes, downtime_minutes, planned_time_minutes,
    good_qty, reject_qty
)
SELECT 
    'MACHINE',
    m.id,
    'DAY',
    (CURRENT_DATE - d.day_offset)::TIMESTAMPTZ,
    (CURRENT_DATE - d.day_offset + 1)::TIMESTAMPTZ,
    80 + (random() * 15)::NUMERIC(5,2) AS availability,
    85 + (random() * 12)::NUMERIC(5,2) AS performance,
    95 + (random() * 4)::NUMERIC(5,2) AS quality,
    (0.80 + random() * 0.15) * (0.85 + random() * 0.12) * (0.95 + random() * 0.04) * 100 AS oee,
    (480 * (0.80 + random() * 0.15))::INTEGER AS run_time,
    (480 * (0.05 + random() * 0.15))::INTEGER AS downtime,
    480,
    (500 * (0.95 + random() * 0.04))::INTEGER AS good_qty,
    (500 * (0.01 + random() * 0.04))::INTEGER AS reject_qty
FROM public.machines m
CROSS JOIN (SELECT generate_series(1, 7) AS day_offset) d;

-- =============================================
-- VERIFY DATA
-- =============================================
SELECT 'Plants' as table_name, COUNT(*) as count FROM public.plants
UNION ALL SELECT 'Lines', COUNT(*) FROM public.lines
UNION ALL SELECT 'Machines', COUNT(*) FROM public.machines
UNION ALL SELECT 'Shifts', COUNT(*) FROM public.shifts
UNION ALL SELECT 'Shift Calendar', COUNT(*) FROM public.shift_calendar
UNION ALL SELECT 'Downtime Reasons', COUNT(*) FROM public.downtime_reasons
UNION ALL SELECT 'Defect Reasons', COUNT(*) FROM public.defect_reasons
UNION ALL SELECT 'OEE Snapshots', COUNT(*) FROM public.oee_snapshots
ORDER BY table_name;
