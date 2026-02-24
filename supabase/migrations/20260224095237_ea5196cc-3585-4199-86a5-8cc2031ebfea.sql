
-- Drop the foreign key constraint that only references downtime_reasons
-- reason_id is used for both downtime_reasons and setup_reasons depending on event_type
ALTER TABLE public.production_events DROP CONSTRAINT production_events_reason_id_fkey;
