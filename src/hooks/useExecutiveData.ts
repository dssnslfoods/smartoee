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

export function useExecutiveData(dateRange: '7' | '14' | '30', isAutoRefresh: boolean) {
  const days = parseInt(dateRange);
  const now = new Date();
  const periodStart = subDays(now, days);
  const previousPeriodStart = subDays(periodStart, days);
  const todayStart = startOfDay(now);

  const { data: plants } = useQuery({
    queryKey: ['exec-plants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ['exec-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('id, name, plant_id')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: plantSnapshots, isLoading: snapshotsLoading, refetch } = useQuery({
    queryKey: ['exec-plant-snapshots', dateRange, plants?.map(p => p.id)],
    queryFn: async () => {
      if (!plants?.length) return [];
      const { data, error } = await supabase
        .from('oee_snapshots')
        .select('*')
        .eq('scope', 'PLANT')
        .in('scope_id', plants.map(p => p.id))
        .gte('period_start', previousPeriodStart.toISOString())
        .order('period_start');
      if (error) throw error;
      return data || [];
    },
    enabled: !!plants?.length,
    refetchInterval: isAutoRefresh ? 30000 : false,
  });

  const { data: lineSnapshots } = useQuery({
    queryKey: ['exec-line-snapshots', dateRange, lines?.map(l => l.id)],
    queryFn: async () => {
      if (!lines?.length) return [];
      const { data, error } = await supabase
        .from('oee_snapshots')
        .select('*')
        .eq('scope', 'LINE')
        .in('scope_id', lines.map(l => l.id))
        .gte('period_start', periodStart.toISOString())
        .order('period_start');
      if (error) throw error;
      return data || [];
    },
    enabled: !!lines?.length,
    refetchInterval: isAutoRefresh ? 30000 : false,
  });

  const { data: downtimeEvents } = useQuery({
    queryKey: ['exec-downtime', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_events')
        .select('id, event_type, start_ts, end_ts, reason_id, line_id, downtime_reasons(name, category)')
        .in('event_type', ['DOWNTIME', 'SETUP'])
        .gte('start_ts', periodStart.toISOString())
        .not('end_ts', 'is', null);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: isAutoRefresh ? 30000 : false,
  });

  const { data: machineTargets } = useQuery({
    queryKey: ['exec-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('target_oee, target_availability, target_performance, target_quality')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Current period summary
  const summary = useMemo<ExecMetrics | null>(() => {
    if (!plantSnapshots) return null;
    const current = plantSnapshots.filter(s => new Date(s.period_start) >= periodStart);
    if (current.length === 0) return null;
    return {
      oee: avgField(current, 'oee'),
      availability: avgField(current, 'availability'),
      performance: avgField(current, 'performance'),
      quality: avgField(current, 'quality'),
    };
  }, [plantSnapshots, periodStart]);

  // Previous period summary (for delta)
  const previousSummary = useMemo<ExecMetrics | null>(() => {
    if (!plantSnapshots) return null;
    const previous = plantSnapshots.filter(s => {
      const d = new Date(s.period_start);
      return d >= previousPeriodStart && d < periodStart;
    });
    if (previous.length === 0) return null;
    return {
      oee: avgField(previous, 'oee'),
      availability: avgField(previous, 'availability'),
      performance: avgField(previous, 'performance'),
      quality: avgField(previous, 'quality'),
    };
  }, [plantSnapshots, previousPeriodStart, periodStart]);

  // Today summary
  const todaySummary = useMemo<ExecMetrics | null>(() => {
    if (!plantSnapshots) return null;
    const today = plantSnapshots.filter(s => new Date(s.period_start) >= todayStart);
    if (today.length === 0) return null;
    return {
      oee: avgField(today, 'oee'),
      availability: avgField(today, 'availability'),
      performance: avgField(today, 'performance'),
      quality: avgField(today, 'quality'),
    };
  }, [plantSnapshots, todayStart]);

  // Targets (average across machines)
  const targets = useMemo<ExecMetrics | null>(() => {
    if (!machineTargets?.length) return null;
    const withTargets = machineTargets.filter(m => m.target_oee != null);
    if (withTargets.length === 0) return null;
    return {
      oee: withTargets.reduce((s, m) => s + (m.target_oee || 0), 0) / withTargets.length,
      availability: withTargets.reduce((s, m) => s + (m.target_availability || 0), 0) / withTargets.length,
      performance: withTargets.reduce((s, m) => s + (m.target_performance || 0), 0) / withTargets.length,
      quality: withTargets.reduce((s, m) => s + (m.target_quality || 0), 0) / withTargets.length,
    };
  }, [machineTargets]);

  // Trend data (daily averages)
  const trendData = useMemo<ExecTrendPoint[]>(() => {
    if (!plantSnapshots) return [];
    const current = plantSnapshots.filter(s => new Date(s.period_start) >= periodStart);
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
  }, [plantSnapshots, periodStart]);

  // Pareto data (top 5)
  const paretoData = useMemo<ExecParetoItem[]>(() => {
    if (!downtimeEvents?.length) return [];
    const reasonMap = new Map<string, number>();
    downtimeEvents.forEach(event => {
      const reasonName = (event.downtime_reasons as any)?.name || 'Unknown';
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

  // Line ranking
  const lineRanking = useMemo<ExecLineRankItem[]>(() => {
    if (!lineSnapshots?.length || !lines?.length) return [];
    const lineMap = new Map<string, { a: number[]; p: number[]; q: number[]; o: number[] }>();
    lineSnapshots.forEach(snap => {
      if (!lineMap.has(snap.scope_id)) lineMap.set(snap.scope_id, { a: [], p: [], q: [], o: [] });
      const e = lineMap.get(snap.scope_id)!;
      if (snap.availability) e.a.push(snap.availability);
      if (snap.performance) e.p.push(snap.performance);
      if (snap.quality) e.q.push(snap.quality);
      if (snap.oee) e.o.push(snap.oee);
    });
    const ranking: ExecLineRankItem[] = [];
    lineMap.forEach((v, lineId) => {
      const line = lines.find(l => l.id === lineId);
      if (!line || v.o.length === 0) return;
      ranking.push({
        id: lineId,
        name: line.name,
        oee: v.o.reduce((a, b) => a + b, 0) / v.o.length,
        availability: v.a.length ? v.a.reduce((a, b) => a + b, 0) / v.a.length : 0,
        performance: v.p.length ? v.p.reduce((a, b) => a + b, 0) / v.p.length : 0,
        quality: v.q.length ? v.q.reduce((a, b) => a + b, 0) / v.q.length : 0,
      });
    });
    return ranking.sort((a, b) => b.oee - a.oee);
  }, [lineSnapshots, lines]);

  // Loss by category
  const lossByCategory = useMemo<ExecLossCategoryItem[]>(() => {
    if (!downtimeEvents?.length) return [];
    const catMap = new Map<string, number>();
    downtimeEvents.forEach(event => {
      const cat = (event.downtime_reasons as any)?.category || 'UNKNOWN';
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

  // Attention items
  const attentionItems = useMemo<ExecAttentionItem[]>(() => {
    const items: ExecAttentionItem[] = [];
    if (!lineSnapshots?.length || !lines?.length) return items;

    const recentCutoff = subDays(now, 3);
    const olderCutoff = subDays(now, Math.min(days, 7));

    const lineMap = new Map<string, { recent: number[]; older: number[]; recentAvail: number[] }>();
    lineSnapshots.forEach(snap => {
      const d = new Date(snap.period_start);
      if (!lineMap.has(snap.scope_id)) lineMap.set(snap.scope_id, { recent: [], older: [], recentAvail: [] });
      const e = lineMap.get(snap.scope_id)!;
      if (d >= recentCutoff) {
        if (snap.oee) e.recent.push(snap.oee);
        if (snap.availability) e.recentAvail.push(snap.availability);
      } else if (d >= olderCutoff && d < recentCutoff) {
        if (snap.oee) e.older.push(snap.oee);
      }
    });

    lineMap.forEach((v, lineId) => {
      const line = lines.find(l => l.id === lineId);
      if (!line) return;

      // Declining OEE
      if (v.recent.length > 0 && v.older.length > 0) {
        const recentAvg = v.recent.reduce((a, b) => a + b, 0) / v.recent.length;
        const olderAvg = v.older.reduce((a, b) => a + b, 0) / v.older.length;
        const delta = recentAvg - olderAvg;
        if (delta < -5) {
          items.push({
            type: 'declining',
            severity: delta < -10 ? 'critical' : 'warning',
            title: `${line.name}: OEE Declining`,
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
            title: `${line.name}: Low Availability`,
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
  }, [lineSnapshots, lines, paretoData, now, days]);

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
