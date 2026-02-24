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
    .select('machine_id, event_type, start_ts, notes, product_id, reason_id, created_by, products(name, code)')
    .in('machine_id', machineIds)
    .is('end_ts', null);

  if (eventError) throw eventError;

  // Fetch reason names from both downtime_reasons and setup_reasons
  const reasonIds = [...new Set((events || []).map(e => e.reason_id).filter(Boolean))] as string[];
  const reasonMap = new Map<string, string>();
  if (reasonIds.length > 0) {
    const [{ data: dtReasons }, { data: setupReasons }] = await Promise.all([
      supabase.from('downtime_reasons').select('id, name').in('id', reasonIds),
      supabase.from('setup_reasons').select('id, name').in('id', reasonIds),
    ]);
    for (const r of dtReasons || []) reasonMap.set(r.id, r.name);
    for (const r of setupReasons || []) reasonMap.set(r.id, r.name);
  }

  // Build event lookup
  const eventMap = new Map<string, (typeof events extends (infer T)[] | null ? T : never) & { _reasonName?: string }>();
  for (const ev of events || []) {
    eventMap.set(ev.machine_id, { ...ev, _reasonName: ev.reason_id ? reasonMap.get(ev.reason_id) : undefined });
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
    const reasonName = ev?._reasonName;

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
      reasonName: reasonName,
      notes: ev?.notes ?? undefined,
      operatorName: ev?.created_by ? operatorMap.get(ev.created_by) : undefined,
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
