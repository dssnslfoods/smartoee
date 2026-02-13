
-- Add production_event_id to link counts to specific events
ALTER TABLE public.production_counts
ADD COLUMN production_event_id uuid REFERENCES public.production_events(id);

-- Index for fast lookup
CREATE INDEX idx_production_counts_event_id ON public.production_counts(production_event_id);
