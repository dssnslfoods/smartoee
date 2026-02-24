import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface ExecMetrics {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface ExecTrendPoint {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface ExecParetoItem {
  reason: string;
  minutes: number;
  percentage: number;
  cumulative: number;
}

export interface ExecLineRankItem {
  id: string;
  name: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface ExecLossCategoryItem {
  category: string;
  minutes: number;
  percentage: number;
}

export interface ExecAttentionItem {
  type: 'declining' | 'low_availability' | 'repeating_loss';
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
}

function avgField(items: any[], field: string): number {
  const vals = items.map(i => i[field]).filter((v): v is number => v != null && v > 0);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

interface MachineInfo {
  id: string;
  name: string;
  line_id: string;
  line_name: string;
  plant_id: string;
  plant_name: string;
  target_oee: number | null;
  target_availability: number | null;
  target_performance: number | null;
  target_quality: number | null;
}

export function useExecutiveData(dateRange: '7' | '14' | '30', isAutoRefresh: boolean) {
  const days = parseInt(dateRange);

  // Stabilize date calculations - only recompute when dateRange changes
  const dates = useMemo(() => {
    const now = new Date();
    const periodStart = subDays(now, days);
    const previousPeriodStart = subDays(periodStart, days);
    const todayStart = startOfDay(now);
    return {
      periodStartISO: periodStart.toISOString(),
      previousPeriodStartISO: previousPeriodStart.toISOString(),
      todayStartISO: todayStart.toISOString(),
      periodStartMs: periodStart.getTime(),
      previousPeriodStartMs: previousPeriodStart.getTime(),
      todayStartMs: todayStart.getTime(),
      nowMs: now.getTime(),
    };
  }, [days]);

  // Machines with line/plant hierarchy
  const { data: machines } = useQuery({
    queryKey: ['exec-machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, line_id, target_oee, target_availability, target_performance, target_quality, line:lines!inner(id, name, plant_id, plant:plants!inner(id, name))')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        line_id: m.line_id,
        line_name: m.line?.name || '',
        plant_id: m.line?.plant_id || '',
        plant_name: m.line?.plant?.name || '',
        target_oee: m.target_oee,
        target_availability: m.target_availability,
        target_performance: m.target_performance,
        target_quality: m.target_quality,
      })) as MachineInfo[];
    },
  });

  // MACHINE-scope snapshots (current + previous period)
  const { data: machineSnapshots, isLoading: snapshotsLoading, refetch } = useQuery({
    queryKey: ['exec-machine-snapshots', dateRange, machines?.map(m => m.id)],
    queryFn: async () => {
      if (!machines?.length) return [];
      const machineIds = machines.map(m => m.id);
      const { data, error } = await supabase
        .from('oee_snapshots')
        .select('*')
        .eq('scope', 'MACHINE')
        .in('scope_id', machineIds)
        .gte('period_start', dates.previousPeriodStartISO)
        .order('period_start');
      if (error) throw error;
      return data || [];
    },
    enabled: !!machines?.length,
    refetchInterval: isAutoRefresh ? 30000 : false,
  });

  // Downtime events with reasons
  const { data: downtimeEvents } = useQuery({
    queryKey: ['exec-downtime', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_events')
        .select('id, event_type, start_ts, end_ts, reason_id, line_id')
        .in('event_type', ['DOWNTIME', 'SETUP'])
        .gte('start_ts', dates.periodStartISO)
        .not('end_ts', 'is', null);
      if (error) throw error;
      const events = data || [];
      
      // Fetch reason names from both tables
      const reasonIds = [...new Set(events.map(e => e.reason_id).filter(Boolean))] as string[];
      const reasonMap = new Map<string, { name: string; category: string }>();
      if (reasonIds.length > 0) {
        const [{ data: dtReasons }, { data: setupReasons }] = await Promise.all([
          supabase.from('downtime_reasons').select('id, name, category').in('id', reasonIds),
          supabase.from('setup_reasons').select('id, name').in('id', reasonIds),
        ]);
        for (const r of dtReasons || []) reasonMap.set(r.id, r);
        for (const r of setupReasons || []) reasonMap.set(r.id, { name: r.name, category: 'CHANGEOVER' });
      }
      
      return events.map(e => ({
        ...e,
        _reason: e.reason_id ? reasonMap.get(e.reason_id) : undefined,
      }));
    },
    refetchInterval: isAutoRefresh ? 30000 : false,
  });

  // Build machine → line/plant lookup
  const machineToLine = useMemo(() => {
    if (!machines) return new Map<string, MachineInfo>();
    const map = new Map<string, MachineInfo>();
    machines.forEach(m => map.set(m.id, m));
    return map;
  }, [machines]);

  // Current period summary (aggregate all machines → plant level)
  const summary = useMemo<ExecMetrics | null>(() => {
    if (!machineSnapshots?.length) return null;
    const current = machineSnapshots.filter(s => new Date(s.period_start).getTime() >= dates.periodStartMs);
    if (current.length === 0) return null;
    return {
      oee: avgField(current, 'oee'),
      availability: avgField(current, 'availability'),
      performance: avgField(current, 'performance'),
      quality: avgField(current, 'quality'),
    };
  }, [machineSnapshots, dates.periodStartMs]);

  // Previous period summary (for delta)
  const previousSummary = useMemo<ExecMetrics | null>(() => {
    if (!machineSnapshots?.length) return null;
    const previous = machineSnapshots.filter(s => {
      const d = new Date(s.period_start).getTime();
      return d >= dates.previousPeriodStartMs && d < dates.periodStartMs;
    });
    if (previous.length === 0) return null;
    return {
      oee: avgField(previous, 'oee'),
      availability: avgField(previous, 'availability'),
      performance: avgField(previous, 'performance'),
      quality: avgField(previous, 'quality'),
    };
  }, [machineSnapshots, dates.previousPeriodStartMs, dates.periodStartMs]);

  // Today summary
  const todaySummary = useMemo<ExecMetrics | null>(() => {
    if (!machineSnapshots?.length) return null;
    const today = machineSnapshots.filter(s => new Date(s.period_start).getTime() >= dates.todayStartMs);
    if (today.length === 0) return null;
    return {
      oee: avgField(today, 'oee'),
      availability: avgField(today, 'availability'),
      performance: avgField(today, 'performance'),
      quality: avgField(today, 'quality'),
    };
  }, [machineSnapshots, dates.todayStartMs]);

  // Targets (average machine targets)
  const targets = useMemo<ExecMetrics | null>(() => {
    if (!machines?.length) return null;
    const withTargets = machines.filter(m => m.target_oee != null);
    if (withTargets.length === 0) return null;
    return {
      oee: withTargets.reduce((s, m) => s + (m.target_oee || 0), 0) / withTargets.length,
      availability: withTargets.reduce((s, m) => s + (m.target_availability || 0), 0) / withTargets.length,
      performance: withTargets.reduce((s, m) => s + (m.target_performance || 0), 0) / withTargets.length,
      quality: withTargets.reduce((s, m) => s + (m.target_quality || 0), 0) / withTargets.length,
    };
  }, [machines]);

  // Trend data (daily averages across all machines)
  const trendData = useMemo<ExecTrendPoint[]>(() => {
    if (!machineSnapshots?.length) return [];
    const current = machineSnapshots.filter(s => new Date(s.period_start).getTime() >= dates.periodStartMs);
    const dateMap = new Map<string, { a: number[]; p: number[]; q: number[]; o: number[] }>();
    current.forEach(snap => {
      const date = format(new Date(snap.period_start), 'MM/dd');
      if (!dateMap.has(date)) dateMap.set(date, { a: [], p: [], q: [], o: [] });
      const e = dateMap.get(date)!;
      if (snap.availability) e.a.push(snap.availability);
      if (snap.performance) e.p.push(snap.performance);
      if (snap.quality) e.q.push(snap.quality);
      if (snap.oee) e.o.push(snap.oee);
    });
    return Array.from(dateMap.entries()).map(([date, v]) => ({
      date,
      availability: v.a.length ? v.a.reduce((a, b) => a + b, 0) / v.a.length : 0,
      performance: v.p.length ? v.p.reduce((a, b) => a + b, 0) / v.p.length : 0,
      quality: v.q.length ? v.q.reduce((a, b) => a + b, 0) / v.q.length : 0,
      oee: v.o.length ? v.o.reduce((a, b) => a + b, 0) / v.o.length : 0,
    }));
  }, [machineSnapshots, dates.periodStartMs]);

  // Pareto data (top 5)
  const paretoData = useMemo<ExecParetoItem[]>(() => {
    if (!downtimeEvents?.length) return [];
    const reasonMap = new Map<string, number>();
    downtimeEvents.forEach(event => {
      const reasonName = event._reason?.name || 'Unknown';
      const duration = event.end_ts && event.start_ts
        ? (new Date(event.end_ts).getTime() - new Date(event.start_ts).getTime()) / 60000
        : 0;
      reasonMap.set(reasonName, (reasonMap.get(reasonName) || 0) + duration);
    });
    const sorted = Array.from(reasonMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = sorted.reduce((sum, [, m]) => sum + m, 0);
    let cumulative = 0;
    return sorted.map(([reason, minutes]) => {
      cumulative += minutes;
      return {
        reason,
        minutes: Math.round(minutes),
        percentage: total > 0 ? (minutes / total) * 100 : 0,
        cumulative: total > 0 ? (cumulative / total) * 100 : 0,
      };
    });
  }, [downtimeEvents]);

  // Line ranking (aggregate machine snapshots by line)
  const lineRanking = useMemo<ExecLineRankItem[]>(() => {
    if (!machineSnapshots?.length || !machines?.length) return [];
    const current = machineSnapshots.filter(s => new Date(s.period_start).getTime() >= dates.periodStartMs);

    const lineMap = new Map<string, { name: string; a: number[]; p: number[]; q: number[]; o: number[] }>();
    current.forEach(snap => {
      const machine = machineToLine.get(snap.scope_id);
      if (!machine) return;
      const lineId = machine.line_id;
      if (!lineMap.has(lineId)) lineMap.set(lineId, { name: machine.line_name, a: [], p: [], q: [], o: [] });
      const e = lineMap.get(lineId)!;
      if (snap.availability) e.a.push(snap.availability);
      if (snap.performance) e.p.push(snap.performance);
      if (snap.quality) e.q.push(snap.quality);
      if (snap.oee) e.o.push(snap.oee);
    });

    const ranking: ExecLineRankItem[] = [];
    lineMap.forEach((v, lineId) => {
      if (v.o.length === 0) return;
      ranking.push({
        id: lineId,
        name: v.name,
        oee: v.o.reduce((a, b) => a + b, 0) / v.o.length,
        availability: v.a.length ? v.a.reduce((a, b) => a + b, 0) / v.a.length : 0,
        performance: v.p.length ? v.p.reduce((a, b) => a + b, 0) / v.p.length : 0,
        quality: v.q.length ? v.q.reduce((a, b) => a + b, 0) / v.q.length : 0,
      });
    });
    return ranking.sort((a, b) => b.oee - a.oee);
  }, [machineSnapshots, machines, machineToLine, dates.periodStartMs]);

  // Loss by category
  const lossByCategory = useMemo<ExecLossCategoryItem[]>(() => {
    if (!downtimeEvents?.length) return [];
    const catMap = new Map<string, number>();
    downtimeEvents.forEach(event => {
      const cat = event._reason?.category || 'UNKNOWN';
      const duration = event.end_ts && event.start_ts
        ? (new Date(event.end_ts).getTime() - new Date(event.start_ts).getTime()) / 60000
        : 0;
      catMap.set(cat, (catMap.get(cat) || 0) + duration);
    });
    const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
    return Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, minutes]) => ({
        category,
        minutes: Math.round(minutes),
        percentage: total > 0 ? (minutes / total) * 100 : 0,
      }));
  }, [downtimeEvents]);

  // Attention items (declining OEE, low availability, repeating losses)
  const attentionItems = useMemo<ExecAttentionItem[]>(() => {
    const items: ExecAttentionItem[] = [];
    if (!machineSnapshots?.length || !machines?.length) return items;

    const recentCutoffMs = subDays(new Date(dates.nowMs), 3).getTime();
    const olderCutoffMs = subDays(new Date(dates.nowMs), Math.min(days, 7)).getTime();

    const current = machineSnapshots.filter(s => new Date(s.period_start).getTime() >= dates.periodStartMs);

    // Group by line
    const lineMap = new Map<string, { name: string; recent: number[]; older: number[]; recentAvail: number[] }>();
    current.forEach(snap => {
      const machine = machineToLine.get(snap.scope_id);
      if (!machine) return;
      const lineId = machine.line_id;
      const d = new Date(snap.period_start).getTime();
      if (!lineMap.has(lineId)) lineMap.set(lineId, { name: machine.line_name, recent: [], older: [], recentAvail: [] });
      const e = lineMap.get(lineId)!;
      if (d >= recentCutoffMs) {
        if (snap.oee) e.recent.push(snap.oee);
        if (snap.availability) e.recentAvail.push(snap.availability);
      } else if (d >= olderCutoffMs && d < recentCutoffMs) {
        if (snap.oee) e.older.push(snap.oee);
      }
    });

    lineMap.forEach((v) => {
      // Declining OEE
      if (v.recent.length > 0 && v.older.length > 0) {
        const recentAvg = v.recent.reduce((a, b) => a + b, 0) / v.recent.length;
        const olderAvg = v.older.reduce((a, b) => a + b, 0) / v.older.length;
        const delta = recentAvg - olderAvg;
        if (delta < -5) {
          items.push({
            type: 'declining',
            severity: delta < -10 ? 'critical' : 'warning',
            title: `${v.name}: OEE Declining`,
            detail: `${delta.toFixed(1)}% vs previous period`,
          });
        }
      }

      // Low availability
      if (v.recentAvail.length > 0) {
        const avgAvail = v.recentAvail.reduce((a, b) => a + b, 0) / v.recentAvail.length;
        if (avgAvail < 70) {
          items.push({
            type: 'low_availability',
            severity: avgAvail < 50 ? 'critical' : 'warning',
            title: `${v.name}: Low Availability`,
            detail: `${avgAvail.toFixed(1)}% average (last 3 days)`,
          });
        }
      }
    });

    // Top repeating loss
    if (paretoData.length > 0 && paretoData[0].percentage > 30) {
      items.push({
        type: 'repeating_loss',
        severity: paretoData[0].percentage > 50 ? 'critical' : 'warning',
        title: `Top Loss: ${paretoData[0].reason}`,
        detail: `${paretoData[0].minutes} min (${paretoData[0].percentage.toFixed(0)}% of total)`,
      });
    }

    return items.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
  }, [machineSnapshots, machines, machineToLine, paretoData, dates.nowMs, days, dates.periodStartMs]);

  return {
    summary,
    previousSummary,
    todaySummary,
    targets,
    trendData,
    paretoData,
    lineRanking,
    lossByCategory,
    attentionItems,
    isLoading: snapshotsLoading,
    refetch,
  };
}
