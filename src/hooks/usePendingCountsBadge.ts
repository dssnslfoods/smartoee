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

      // Get completed RUN events (must have shift_calendar_id — matching page's inner join)
      const { data: events } = await supabase
        .from("production_events")
        .select("id, machine_id, shift_calendar_id")
        .eq("event_type", "RUN")
        .not("end_ts", "is", null)
        .not("shift_calendar_id", "is", null)
        .in("machine_id", machineIds);

      if (!events?.length) return 0;

      // Get shift_calendar_ids that have events
      const scIds = [...new Set(events.map(e => e.shift_calendar_id).filter(Boolean))] as string[];
      if (!scIds.length) return events.length;

      // Get counts only for relevant shift_calendar_ids (matching page logic)
      const { data: allCounts } = await supabase
        .from("production_counts")
        .select("machine_id, shift_calendar_id")
        .in("machine_id", machineIds)
        .in("shift_calendar_id", scIds);

      const countSet = new Set(
        (allCounts || []).map((c) => `${c.machine_id}::${c.shift_calendar_id}`)
      );

      // Count individual events whose machine+shift combo has no counts
      return events.filter(
        (e) => !countSet.has(`${e.machine_id}::${e.shift_calendar_id}`)
      ).length;
    },
    enabled: !!user && !!company,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return count;
}
