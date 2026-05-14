import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingCountsBadge() {
  const { user, company } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["pending-counts-badge", company?.id],
    queryFn: async () => {
      if (!company) return 0;
      const { data, error } = await supabase.rpc("rpc_count_pending_run_events" as any, {
        p_company_id: company.id,
      });
      if (error) {
        console.error("rpc_count_pending_run_events failed:", error);
        return 0;
      }
      return Number(data) || 0;
    },
    enabled: !!user && !!company,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return count;
}
