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
        .select("id, machine_id, shift_calendar_id")
        .eq("event_type", "RUN")
        .not("end_ts", "is", null)
        .not("shift_calendar_id", "is", null)
        .in("machine_id", machineIds);

      if (!events?.length) return 0;

      const eventIds = events.map(e => e.id);
      const shiftIds = [...new Set(events.map(e => e.shift_calendar_id).filter(Boolean))] as string[];

      // Two-way check: (a) counts linked via production_event_id, (b) any count for same machine+shift
      const [{ data: linkedCounts }, { data: shiftCounts }] = await Promise.all([
        supabase
          .from("production_counts")
          .select("production_event_id")
          .in("production_event_id", eventIds)
          .not("production_event_id", "is", null),
        shiftIds.length > 0
          ? supabase
              .from("production_counts")
              .select("machine_id, shift_calendar_id")
              .in("machine_id", machineIds)
              .in("shift_calendar_id", shiftIds)
          : Promise.resolve({ data: [] as { machine_id: string; shift_calendar_id: string }[] }),
      ]);

      const linkedSet = new Set(
        (linkedCounts || []).map((c: any) => c.production_event_id).filter(Boolean)
      );
      const shiftMachineSet = new Set(
        (shiftCounts || []).map((c: any) => `${c.machine_id}|${c.shift_calendar_id}`)
      );

      return events.filter(e =>
        !linkedSet.has(e.id) &&
        !(e.shift_calendar_id && shiftMachineSet.has(`${e.machine_id}|${e.shift_calendar_id}`))
      ).length;
    },
    enabled: !!user && !!company,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return count;
}
