-- =============================================
-- PNF OEE System - Seed Data (FIXED VERSION)
-- Run this AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- STEP 1: PLANTS
INSERT INTO public.plants (id, name, code) VALUES
    ('11111111-1111-1111-1111-111111111111', 'PNF Plant 1 - Main Factory', 'PLT-001'),
    ('22222222-2222-2222-2222-222222222222', 'PNF Plant 2 - Assembly', 'PLT-002')
ON CONFLICT (id) DO NOTHING;

-- STEP 2: PRODUCTION LINES
INSERT INTO public.lines (id, plant_id, name, code) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'CNC Line 1', 'LINE-001'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'CNC Line 2', 'LINE-002'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Press Line', 'LINE-003'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Assembly Line 1', 'LINE-004'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Assembly Line 2', 'LINE-005')
ON CONFLICT (id) DO NOTHING;

-- STEP 3: MACHINES
INSERT INTO public.machines (id, line_id, name, code, ideal_cycle_time_seconds) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 01', 'CNC-001', 45.5),
    ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 02', 'CNC-002', 45.5),
    ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNC Machine 03', 'CNC-003', 60.0),
    ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNC Machine 04', 'CNC-004', 30.0),
    ('b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNC Machine 05', 'CNC-005', 30.0),
    ('c1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 01', 'PRS-001', 15.0),
    ('c2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 02', 'PRS-002', 15.0),
    ('c3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Press Machine 03', 'PRS-003', 20.0),
    ('d1111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Assembly Station 01', 'ASM-001', 120.0),
    ('d2222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Assembly Station 02', 'ASM-002', 120.0),
    ('e1111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Assembly Station 03', 'ASM-003', 90.0),
    ('e2222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Assembly Station 04', 'ASM-004', 90.0)
ON CONFLICT (id) DO NOTHING;

-- STEP 4: SHIFTS
INSERT INTO public.shifts (id, name, start_time, end_time) VALUES
    ('fa111111-1111-1111-1111-111111111111', 'Morning Shift', '06:00:00', '14:00:00'),
    ('fa222222-2222-2222-2222-222222222222', 'Afternoon Shift', '14:00:00', '22:00:00'),
    ('fa333333-3333-3333-3333-333333333333', 'Night Shift', '22:00:00', '06:00:00')
ON CONFLICT (id) DO NOTHING;

-- STEP 5: DOWNTIME REASONS
INSERT INTO public.downtime_reasons (id, code, name, category) VALUES
    ('da111111-1111-1111-1111-111111111111', 'DT-001', 'Scheduled Maintenance', 'PLANNED'),
    ('da222222-2222-2222-2222-222222222222', 'DT-002', 'Scheduled Break', 'PLANNED'),
    ('da333333-3333-3333-3333-333333333333', 'DT-003', 'Shift Handover', 'PLANNED'),
    ('da444444-4444-4444-4444-444444444444', 'DT-004', 'Machine Breakdown', 'BREAKDOWN'),
    ('da555555-5555-5555-5555-555555555555', 'DT-005', 'Tool Failure', 'BREAKDOWN'),
    ('da666666-6666-6666-6666-666666666666', 'DT-006', 'Material Shortage', 'UNPLANNED'),
    ('da777777-7777-7777-7777-777777777777', 'DT-007', 'Operator Absence', 'UNPLANNED'),
    ('da888888-8888-8888-8888-888888888888', 'DT-008', 'Quality Issue', 'UNPLANNED'),
    ('da999999-9999-9999-9999-999999999999', 'DT-009', 'Product Changeover', 'CHANGEOVER'),
    ('daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DT-010', 'Tool Changeover', 'CHANGEOVER'),
    ('dabbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DT-011', 'Setup Adjustment', 'CHANGEOVER')
ON CONFLICT (id) DO NOTHING;

-- STEP 6: DEFECT REASONS
INSERT INTO public.defect_reasons (id, code, name) VALUES
    ('de111111-1111-1111-1111-111111111111', 'DF-001', 'Dimensional Out of Spec'),
    ('de222222-2222-2222-2222-222222222222', 'DF-002', 'Surface Defect'),
    ('de333333-3333-3333-3333-333333333333', 'DF-003', 'Material Defect'),
    ('de444444-4444-4444-4444-444444444444', 'DF-004', 'Assembly Error'),
    ('de555555-5555-5555-5555-555555555555', 'DF-005', 'Machining Error'),
    ('de666666-6666-6666-6666-666666666666', 'DF-006', 'Coating Defect'),
    ('de777777-7777-7777-7777-777777777777', 'DF-007', 'Packaging Damage'),
    ('de888888-8888-8888-8888-888888888888', 'DF-008', 'Other')
ON CONFLICT (id) DO NOTHING;

-- STEP 7: SHIFT CALENDAR
DO $$
DECLARE
    day_offset INTEGER;
    current_day DATE;
BEGIN
    FOR day_offset IN 0..7 LOOP
        current_day := CURRENT_DATE + day_offset;
        
        INSERT INTO public.shift_calendar (shift_id, shift_date, plant_id, planned_time_minutes)
        VALUES 
            ('fa111111-1111-1111-1111-111111111111', current_day, '11111111-1111-1111-1111-111111111111', 480),
            ('fa222222-2222-2222-2222-222222222222', current_day, '11111111-1111-1111-1111-111111111111', 480),
            ('fa333333-3333-3333-3333-333333333333', current_day, '11111111-1111-1111-1111-111111111111', 480),
            ('fa111111-1111-1111-1111-111111111111', current_day, '22222222-2222-2222-2222-222222222222', 480),
            ('fa222222-2222-2222-2222-222222222222', current_day, '22222222-2222-2222-2222-222222222222', 480)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- STEP 8: SAMPLE OEE SNAPSHOTS
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

-- VERIFY
SELECT 'Plants' as table_name, COUNT(*) as count FROM public.plants
UNION ALL SELECT 'Lines', COUNT(*) FROM public.lines
UNION ALL SELECT 'Machines', COUNT(*) FROM public.machines
UNION ALL SELECT 'Shifts', COUNT(*) FROM public.shifts
UNION ALL SELECT 'Shift Calendar', COUNT(*) FROM public.shift_calendar
UNION ALL SELECT 'Downtime Reasons', COUNT(*) FROM public.downtime_reasons
UNION ALL SELECT 'Defect Reasons', COUNT(*) FROM public.defect_reasons
UNION ALL SELECT 'OEE Snapshots', COUNT(*) FROM public.oee_snapshots;
