import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingCountsBadge() {
  const { user, company } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user || !company) {
      setCount(0);
      return;
    }

    const fetchPending = async () => {
      try {
        const { data: machines } = await supabase
          .from("machines")
          .select("id")
          .eq("company_id", company.id)
          .eq("is_active", true);

        if (!machines?.length) { setCount(0); return; }
        const machineIds = machines.map((m) => m.id);

        const { data: events } = await supabase
          .from("production_events")
          .select("id, machine_id, shift_calendar_id")
          .eq("event_type", "RUN")
          .not("end_ts", "is", null)
          .in("machine_id", machineIds);

        if (!events?.length) { setCount(0); return; }

        const { data: allCounts } = await supabase
          .from("production_counts")
          .select("machine_id, shift_calendar_id")
          .in("machine_id", machineIds);

        const countSet = new Set(
          (allCounts || []).map((c) => `${c.machine_id}_${c.shift_calendar_id}`)
        );

        const pending = events.filter(
          (e) => !countSet.has(`${e.machine_id}_${e.shift_calendar_id}`)
        );

        setCount(pending.length);
      } catch {
        setCount(0);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60_000);
    return () => clearInterval(interval);
  }, [user, company]);

  return count;
}
