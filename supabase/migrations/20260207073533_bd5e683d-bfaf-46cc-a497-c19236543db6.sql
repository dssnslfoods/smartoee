-- Enable realtime for production_events table so monitor page gets instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_events;