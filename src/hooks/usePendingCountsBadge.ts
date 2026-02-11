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

      const { data: events } = await supabase
        .from("production_events")
        .select("id, machine_id, shift_calendar_id")
        .eq("event_type", "RUN")
        .not("end_ts", "is", null)
        .in("machine_id", machineIds);

      if (!events?.length) return 0;

      const { data: allCounts } = await supabase
        .from("production_counts")
        .select("machine_id, shift_calendar_id")
        .in("machine_id", machineIds);

      const countSet = new Set(
        (allCounts || []).map((c) => `${c.machine_id}_${c.shift_calendar_id}`)
      );

      return events.filter(
        (e) => !countSet.has(`${e.machine_id}_${e.shift_calendar_id}`)
      ).length;
    },
    enabled: !!user && !!company,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return count;
}
