import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingCountsBadge() {
  const { user, company } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['pending-counts-badge', company?.id],
    queryFn: async () => {
      if (!company) return 0;

      const { data: machines } = await supabase
        .from("machines")
        .select("id")
        .eq("company_id", company.id)
        .eq("is_active", true);

      if (!machines?.length) return 0;
      const machineIds = machines.map((m) => m.id);

      // Get completed RUN events (must have shift_calendar_id)
      const { data: events } = await supabase
        .from("production_events")
        .select("id")
        .eq("event_type", "RUN")
        .not("end_ts", "is", null)
        .not("shift_calendar_id", "is", null)
        .in("machine_id", machineIds);

      if (!events?.length) return 0;

      const eventIds = events.map(e => e.id);

      // Get event IDs that already have counts (per-event tracking)
      const { data: countedEvents } = await supabase
        .from("production_counts")
        .select("production_event_id")
        .in("production_event_id", eventIds)
        .not("production_event_id", "is", null);

      const countedSet = new Set(
        (countedEvents || []).map((c: any) => c.production_event_id).filter(Boolean)
      );

      // Count events that don't have counts yet
      return events.filter(e => !countedSet.has(e.id)).length;
    },
    enabled: !!user && !!company,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return count;
}
