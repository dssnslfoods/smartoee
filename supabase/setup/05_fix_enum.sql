-- =============================================
-- 6. FIX ENUM FOR event_type
-- =============================================

-- Add the missing 'RUN' value to the event_type ENUM
-- Note: PostgreSQL allows adding values to ENUMs but not removing them directly.
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'RUN';
