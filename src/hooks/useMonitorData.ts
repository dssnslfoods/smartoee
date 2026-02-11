import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPermittedMachineIds } from '@/services/oeeApi';

export interface MonitorMachine {
  id: string;
  name: string;
  code: string;
  line_id: string;
  line_name?: string;
  plant_id?: string;
  plant_name?: string;
  status: 'running' | 'idle' | 'stopped' | 'maintenance';
  eventType?: string;
  startTs?: string;
  productName?: string;
  productCode?: string;
  reasonName?: string;
  notes?: string;
  operatorName?: string;
  pendingCounts: number; // Completed RUN events without production counts
}

export interface MonitorStats {
  running: number;
  idle: number;
  stopped: number;
  maintenance: number;
  total: number;
}

async function fetchMonitorData(companyId?: string): Promise<{ machines: MonitorMachine[]; stats: MonitorStats }> {
  // Get machines the user can see (RLS handles permissions)
  let machineQuery = supabase
    .from('machines')
    .select('id, name, code, line_id, is_active, lines(name, plant_id, plants(name))')
    .eq('is_active', true)
    .order('name');

  if (companyId) {
    machineQuery = machineQuery.eq('company_id', companyId);
  }

  const { data: machines, error: machineError } = await machineQuery;
  if (machineError) throw machineError;
  if (!machines || machines.length === 0) {
    return { machines: [], stats: { running: 0, idle: 0, stopped: 0, maintenance: 0, total: 0 } };
  }

  const machineIds = machines.map(m => m.id);

  // Get open events (end_ts IS NULL) with product + operator info
  const { data: events, error: eventError } = await supabase
    .from('production_events')
    .select('machine_id, event_type, start_ts, notes, product_id, reason_id, created_by, products(name, code), downtime_reasons(name)')
    .in('machine_id', machineIds)
    .is('end_ts', null);

  if (eventError) throw eventError;

  // Build event lookup
  const eventMap = new Map<string, typeof events extends (infer T)[] | null ? T : never>();
  for (const ev of events || []) {
    eventMap.set(ev.machine_id, ev);
  }

  // Get operator names for active events
  const creatorIds = [...new Set((events || []).map(e => e.created_by).filter(Boolean))];
  const operatorMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', creatorIds);
    for (const p of profiles || []) {
      operatorMap.set(p.user_id, p.full_name);
    }
  }

  // Detect pending counts: completed RUN events without any production_counts in the same shift
  // Get today's shift_calendar IDs
  const today = new Date().toISOString().split('T')[0];
  const { data: todayShifts } = await supabase
    .from('shift_calendar')
    .select('id')
    .eq('shift_date', today);
  
  const shiftCalendarIds = (todayShifts || []).map(s => s.id);
  
  const pendingCountMap = new Map<string, number>();
  if (shiftCalendarIds.length > 0) {
    // Get completed RUN events for today
    const { data: completedRuns } = await supabase
      .from('production_events')
      .select('machine_id, shift_calendar_id')
      .in('machine_id', machineIds)
      .in('shift_calendar_id', shiftCalendarIds)
      .eq('event_type', 'RUN')
      .not('end_ts', 'is', null);

    if (completedRuns && completedRuns.length > 0) {
      // Get production_counts for today's shifts per machine
      const { data: counts } = await supabase
        .from('production_counts')
        .select('machine_id, shift_calendar_id')
        .in('machine_id', machineIds)
        .in('shift_calendar_id', shiftCalendarIds);

      // Build set of machines that have counts per shift
      const hasCountsSet = new Set<string>();
      for (const c of counts || []) {
        hasCountsSet.add(`${c.machine_id}::${c.shift_calendar_id}`);
      }

      // Count completed RUN events without counts per machine
      for (const run of completedRuns) {
        const key = `${run.machine_id}::${run.shift_calendar_id}`;
        if (!hasCountsSet.has(key)) {
          pendingCountMap.set(run.machine_id, (pendingCountMap.get(run.machine_id) || 0) + 1);
        }
      }
    }
  }

  const stats: MonitorStats = { running: 0, idle: 0, stopped: 0, maintenance: 0, total: machines.length };

  const result: MonitorMachine[] = machines.map(machine => {
    const line = machine.lines as { name: string; plant_id: string; plants: { name: string } | null } | null;
    const ev = eventMap.get(machine.id);

    let status: MonitorMachine['status'] = 'idle';
    if (ev) {
      switch (ev.event_type) {
        case 'RUN': status = 'running'; break;
        case 'DOWNTIME': status = 'stopped'; break;
        case 'SETUP': status = 'maintenance'; break;
      }
    }
    stats[status]++;

    const product = ev?.products as { name: string; code: string } | null;
    const reason = ev?.downtime_reasons as { name: string } | null;

    return {
      id: machine.id,
      name: machine.name,
      code: machine.code,
      line_id: machine.line_id,
      line_name: line?.name,
      plant_id: line?.plant_id,
      plant_name: line?.plants?.name,
      status,
      eventType: ev?.event_type,
      startTs: ev?.start_ts,
      productName: product?.name,
      productCode: product?.code,
      reasonName: reason?.name,
      notes: ev?.notes ?? undefined,
      operatorName: ev?.created_by ? operatorMap.get(ev.created_by) : undefined,
      pendingCounts: pendingCountMap.get(machine.id) || 0,
    };
  });

  return { machines: result, stats };
}

export function useMonitorData() {
  const { company, hasRole, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const isStaff = hasRole('STAFF') && !isAdmin() && !hasRole('SUPERVISOR');

  const query = useQuery({
    queryKey: ['monitor-machines', companyId],
    queryFn: () => fetchMonitorData(companyId),
    refetchInterval: 15000, // Fallback polling every 15s
  });

  // Fetch permitted machine IDs for STAFF
  const { data: permittedIds } = useQuery({
    queryKey: ['permittedMachineIds'],
    queryFn: () => getPermittedMachineIds(),
    enabled: isStaff,
  });

  // Filter machines for STAFF role
  const filteredData = useMemo(() => {
    if (!query.data) return query.data;
    if (!isStaff || !permittedIds) return query.data;

    const idSet = new Set(permittedIds);
    const machines = query.data.machines.filter(m => idSet.has(m.id));

    // Recalculate stats for filtered machines
    const stats: MonitorStats = { running: 0, idle: 0, stopped: 0, maintenance: 0, total: machines.length };
    for (const m of machines) {
      stats[m.status]++;
    }

    return { machines, stats };
  }, [query.data, isStaff, permittedIds]);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('monitor-production-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_events',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['monitor-machines'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    ...query,
    data: filteredData,
  };
}
