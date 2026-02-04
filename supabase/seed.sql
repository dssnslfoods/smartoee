-- =============================================
-- PNF OEE System - Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. PLANTS
-- =============================================

INSERT INTO public.plants (id, name, code) VALUES
    ('11111111-1111-1111-1111-111111111111', 'PNF Plant 1 - Main Factory', 'PLT-001'),
    ('22222222-2222-2222-2222-222222222222', 'PNF Plant 2 - Assembly', 'PLT-002');

-- =============================================
-- 2. PRODUCTION LINES
-- =============================================

INSERT INTO public.lines (id, plant_id, name, code) VALUES
    -- Plant 1 Lines
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'CNC Line 1', 'LINE-001'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'CNC Line 2', 'LINE-002'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Press Line', 'LINE-003'),
    -- Plant 2 Lines
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Assembly Line 1', 'LINE-004'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Assembly Line 2', 'LINE-005');

-- =============================================
-- 3. MACHINES
-- =============================================

INSERT INTO public.machines (id, line_id, name, code, ideal_cycle_time_seconds) VALUES
    -- CNC Line 1 Machines
    ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 01', 'CNC-001', 45.5),
    ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 02', 'CNC-002', 45.5),
    ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 03', 'CNC-003', 60.0),
    -- CNC Line 2 Machines
    ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNC Machine 04', 'CNC-004', 30.0),
    ('b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNC Machine 05', 'CNC-005', 30.0),
    -- Press Line Machines
    ('c1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 01', 'PRS-001', 15.0),
    ('c2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 02', 'PRS-002', 15.0),
    ('c3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 03', 'PRS-003', 20.0),
    -- Assembly Line 1 Machines
    ('d1111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Assembly Station 01', 'ASM-001', 120.0),
    ('d2222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Assembly Station 02', 'ASM-002', 120.0),
    -- Assembly Line 2 Machines
    ('e1111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Assembly Station 03', 'ASM-003', 90.0),
    ('e2222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Assembly Station 04', 'ASM-004', 90.0);

-- =============================================
-- 4. SHIFTS
-- =============================================

INSERT INTO public.shifts (id, name, start_time, end_time) VALUES
    ('s1111111-1111-1111-1111-111111111111', 'Morning Shift', '06:00:00', '14:00:00'),
    ('s2222222-2222-2222-2222-222222222222', 'Afternoon Shift', '14:00:00', '22:00:00'),
    ('s3333333-3333-3333-3333-333333333333', 'Night Shift', '22:00:00', '06:00:00');

-- =============================================
-- 5. SHIFT CALENDAR (Sample for current week)
-- =============================================

-- Generate shift calendar for today and next 7 days
DO $$
DECLARE
    day_offset INTEGER;
    current_day DATE;
BEGIN
    FOR day_offset IN 0..7 LOOP
        current_day := CURRENT_DATE + day_offset;
        
        -- Plant 1 shifts
        INSERT INTO public.shift_calendar (shift_id, shift_date, plant_id, planned_time_minutes)
        VALUES 
            ('s1111111-1111-1111-1111-111111111111', current_day, '11111111-1111-1111-1111-111111111111', 480),
            ('s2222222-2222-2222-2222-222222222222', current_day, '11111111-1111-1111-1111-111111111111', 480),
            ('s3333333-3333-3333-3333-333333333333', current_day, '11111111-1111-1111-1111-111111111111', 480)
        ON CONFLICT DO NOTHING;
        
        -- Plant 2 shifts (no night shift)
        INSERT INTO public.shift_calendar (shift_id, shift_date, plant_id, planned_time_minutes)
        VALUES 
            ('s1111111-1111-1111-1111-111111111111', current_day, '22222222-2222-2222-2222-222222222222', 480),
            ('s2222222-2222-2222-2222-222222222222', current_day, '22222222-2222-2222-2222-222222222222', 480)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- =============================================
-- 6. DOWNTIME REASONS
-- =============================================

INSERT INTO public.downtime_reasons (id, code, name, category) VALUES
    -- Planned Downtime
    ('dt111111-1111-1111-1111-111111111111', 'DT-001', 'Scheduled Maintenance', 'PLANNED'),
    ('dt222222-2222-2222-2222-222222222222', 'DT-002', 'Scheduled Break', 'PLANNED'),
    ('dt333333-3333-3333-3333-333333333333', 'DT-003', 'Shift Handover', 'PLANNED'),
    -- Unplanned Downtime
    ('dt444444-4444-4444-4444-444444444444', 'DT-004', 'Machine Breakdown', 'BREAKDOWN'),
    ('dt555555-5555-5555-5555-555555555555', 'DT-005', 'Tool Failure', 'BREAKDOWN'),
    ('dt666666-6666-6666-6666-666666666666', 'DT-006', 'Material Shortage', 'UNPLANNED'),
    ('dt777777-7777-7777-7777-777777777777', 'DT-007', 'Operator Absence', 'UNPLANNED'),
    ('dt888888-8888-8888-8888-888888888888', 'DT-008', 'Quality Issue', 'UNPLANNED'),
    -- Changeover
    ('dt999999-9999-9999-9999-999999999999', 'DT-009', 'Product Changeover', 'CHANGEOVER'),
    ('dta00000-0000-0000-0000-000000000000', 'DT-010', 'Tool Changeover', 'CHANGEOVER'),
    ('dtb00000-0000-0000-0000-000000000000', 'DT-011', 'Setup Adjustment', 'CHANGEOVER');

-- =============================================
-- 7. DEFECT REASONS
-- =============================================

INSERT INTO public.defect_reasons (id, code, name) VALUES
    ('df111111-1111-1111-1111-111111111111', 'DF-001', 'Dimensional Out of Spec'),
    ('df222222-2222-2222-2222-222222222222', 'DF-002', 'Surface Defect'),
    ('df333333-3333-3333-3333-333333333333', 'DF-003', 'Material Defect'),
    ('df444444-4444-4444-4444-444444444444', 'DF-004', 'Assembly Error'),
    ('df555555-5555-5555-5555-555555555555', 'DF-005', 'Machining Error'),
    ('df666666-6666-6666-6666-666666666666', 'DF-006', 'Coating Defect'),
    ('df777777-7777-7777-7777-777777777777', 'DF-007', 'Packaging Damage'),
    ('df888888-8888-8888-8888-888888888888', 'DF-008', 'Other');

-- =============================================
-- 8. SAMPLE OEE SNAPSHOTS (Historical Data)
-- =============================================

-- Generate sample OEE data for last 7 days for each machine
DO $$
DECLARE
    machine_rec RECORD;
    day_offset INTEGER;
    sample_date DATE;
    sample_availability NUMERIC;
    sample_performance NUMERIC;
    sample_quality NUMERIC;
    sample_oee NUMERIC;
BEGIN
    FOR machine_rec IN SELECT id FROM public.machines LOOP
        FOR day_offset IN 1..7 LOOP
            sample_date := CURRENT_DATE - day_offset;
            
            -- Generate random but realistic OEE values
            sample_availability := 80 + (random() * 15)::NUMERIC(5,2);
            sample_performance := 85 + (random() * 12)::NUMERIC(5,2);
            sample_quality := 95 + (random() * 4)::NUMERIC(5,2);
            sample_oee := (sample_availability * sample_performance * sample_quality / 10000)::NUMERIC(5,2);
            
            INSERT INTO public.oee_snapshots (
                scope, scope_id, period, period_start, period_end,
                availability, performance, quality, oee,
                run_time_minutes, downtime_minutes, planned_time_minutes,
                good_qty, reject_qty
            ) VALUES (
                'MACHINE',
                machine_rec.id,
                'DAY',
                sample_date::TIMESTAMPTZ,
                (sample_date + INTERVAL '1 day')::TIMESTAMPTZ,
                sample_availability,
                sample_performance,
                sample_quality,
                sample_oee,
                (480 * sample_availability / 100)::INTEGER,
                (480 * (100 - sample_availability) / 100)::INTEGER,
                480,
                (500 * sample_quality / 100)::INTEGER,
                (500 * (100 - sample_quality) / 100)::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- =============================================
-- 9. VERIFY DATA
-- =============================================

-- Show summary of seeded data
SELECT 'Plants' as table_name, COUNT(*) as count FROM public.plants
UNION ALL
SELECT 'Lines', COUNT(*) FROM public.lines
UNION ALL
SELECT 'Machines', COUNT(*) FROM public.machines
UNION ALL
SELECT 'Shifts', COUNT(*) FROM public.shifts
UNION ALL
SELECT 'Shift Calendar', COUNT(*) FROM public.shift_calendar
UNION ALL
SELECT 'Downtime Reasons', COUNT(*) FROM public.downtime_reasons
UNION ALL
SELECT 'Defect Reasons', COUNT(*) FROM public.defect_reasons
UNION ALL
SELECT 'OEE Snapshots', COUNT(*) FROM public.oee_snapshots;
