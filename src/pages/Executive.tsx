import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Calendar, RefreshCw, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { OEETrendChart } from '@/components/dashboard/OEETrendChart';
import {
  SummaryCards,
  ParetoChart,
  DrillDownBreadcrumb,
  DrillDownSelector,
  type DrillLevel,
} from '@/components/executive';

interface BreadcrumbItem {
  level: DrillLevel;
  id: string;
  name: string;
}

export default function Executive() {
  const { hasRole } = useAuth();
  
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('7');
  const [drillPath, setDrillPath] = useState<BreadcrumbItem[]>([]);

  const currentLevel = drillPath.length === 0 ? 'plant' : drillPath[drillPath.length - 1].level;
  const currentId = drillPath.length === 0 ? undefined : drillPath[drillPath.length - 1].id;

  const { data: plants } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ['lines', currentId],
    queryFn: async () => {
      if (!currentId || currentLevel !== 'plant') return null;
      const { data, error } = await supabase
        .from('lines')
        .select('id, name, code')
        .eq('plant_id', currentId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: currentLevel === 'plant' && !!currentId,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines', currentId],
    queryFn: async () => {
      if (!currentId || currentLevel !== 'line') return null;
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, code')
        .eq('line_id', currentId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: currentLevel === 'line' && !!currentId,
  });

  const { data: oeeData, isLoading: oeeLoading, refetch: refetchOee } = useQuery({
    queryKey: ['oee-snapshots', currentLevel, currentId, dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      
      let scope: 'PLANT' | 'LINE' | 'MACHINE' = 'PLANT';
      let scopeIds: string[] | undefined;

      if (drillPath.length === 0) {
        scope = 'PLANT';
        scopeIds = plants?.map(p => p.id);
      } else if (currentLevel === 'plant') {
        scope = 'LINE';
        scopeIds = lines?.map(l => l.id);
      } else if (currentLevel === 'line') {
        scope = 'MACHINE';
        scopeIds = machines?.map(m => m.id);
      } else if (currentLevel === 'machine') {
        scope = 'MACHINE';
        scopeIds = currentId ? [currentId] : undefined;
      }

      if (!scopeIds || scopeIds.length === 0) {
        return { snapshots: [], summary: null };
      }

      const { data, error } = await supabase
        .from('oee_snapshots')
        .select('*')
        .eq('scope', scope)
        .in('scope_id', scopeIds)
        .gte('period_start', startDate.toISOString())
        .order('period_start', { ascending: true });

      if (error) throw error;

      const summary = data && data.length > 0 ? {
        availability: data.reduce((sum, d) => sum + (d.availability || 0), 0) / data.length,
        performance: data.reduce((sum, d) => sum + (d.performance || 0), 0) / data.length,
        quality: data.reduce((sum, d) => sum + (d.quality || 0), 0) / data.length,
        oee: data.reduce((sum, d) => sum + (d.oee || 0), 0) / data.length,
      } : null;

      return { snapshots: data || [], summary };
    },
    enabled: plants !== undefined,
  });

  const { data: downtimeData } = useQuery({
    queryKey: ['downtime-pareto', currentId, dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      
      let query = supabase
        .from('production_events')
        .select(`
          id,
          event_type,
          start_ts,
          end_ts,
          reason_id,
          downtime_reasons(name)
        `)
        .in('event_type', ['DOWNTIME', 'SETUP'])
        .gte('start_ts', startDate.toISOString())
        .not('end_ts', 'is', null);

      if (currentId) {
        if (currentLevel === 'plant' || drillPath.find(p => p.level === 'plant')) {
          const plantId = drillPath.find(p => p.level === 'plant')?.id || currentId;
          query = query.eq('plant_id', plantId);
        }
        if (currentLevel === 'line' || drillPath.find(p => p.level === 'line')) {
          const lineId = drillPath.find(p => p.level === 'line')?.id || currentId;
          query = query.eq('line_id', lineId);
        }
        if (currentLevel === 'machine') {
          query = query.eq('machine_id', currentId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const reasonMap = new Map<string, number>();
      data?.forEach(event => {
        const reasonName = (event.downtime_reasons as { name: string } | null)?.name || 'Unknown';
        const duration = event.end_ts && event.start_ts 
          ? (new Date(event.end_ts).getTime() - new Date(event.start_ts).getTime()) / 60000
          : 0;
        reasonMap.set(reasonName, (reasonMap.get(reasonName) || 0) + duration);
      });

      const sorted = Array.from(reasonMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const total = sorted.reduce((sum, [, mins]) => sum + mins, 0);
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
    },
  });

  const trendData = useMemo(() => {
    if (!oeeData?.snapshots) return [];

    const dateMap = new Map<string, { 
      availability: number[]; 
      performance: number[]; 
      quality: number[]; 
      oee: number[] 
    }>();

    oeeData.snapshots.forEach(snap => {
      const date = format(new Date(snap.period_start), 'MM/dd');
      if (!dateMap.has(date)) {
        dateMap.set(date, { availability: [], performance: [], quality: [], oee: [] });
      }
      const entry = dateMap.get(date)!;
      if (snap.availability) entry.availability.push(snap.availability);
      if (snap.performance) entry.performance.push(snap.performance);
      if (snap.quality) entry.quality.push(snap.quality);
      if (snap.oee) entry.oee.push(snap.oee);
    });

    return Array.from(dateMap.entries()).map(([date, values]) => ({
      date,
      availability: values.availability.length > 0 
        ? values.availability.reduce((a, b) => a + b, 0) / values.availability.length 
        : 0,
      performance: values.performance.length > 0 
        ? values.performance.reduce((a, b) => a + b, 0) / values.performance.length 
        : 0,
      quality: values.quality.length > 0 
        ? values.quality.reduce((a, b) => a + b, 0) / values.quality.length 
        : 0,
      oee: values.oee.length > 0 
        ? values.oee.reduce((a, b) => a + b, 0) / values.oee.length 
        : 0,
    }));
  }, [oeeData?.snapshots]);

  const handleNavigate = (level: DrillLevel, id?: string) => {
    if (level === 'plant' && !id) {
      setDrillPath([]);
    } else {
      const index = drillPath.findIndex(p => p.level === level && p.id === id);
      if (index >= 0) {
        setDrillPath(drillPath.slice(0, index + 1));
      }
    }
  };

  const handleDrillDown = (id: string, name: string) => {
    const nextLevel: DrillLevel = 
      drillPath.length === 0 ? 'plant' :
      currentLevel === 'plant' ? 'line' :
      currentLevel === 'line' ? 'machine' : 'shift';

    setDrillPath([...drillPath, { level: nextLevel, id, name }]);
  };

  const drillItems = useMemo(() => {
    if (drillPath.length === 0 && plants) {
      return plants.map(p => ({ id: p.id, name: p.name, oee: undefined }));
    }
    if (currentLevel === 'plant' && lines) {
      return lines.map(l => ({ id: l.id, name: l.name, oee: undefined }));
    }
    if (currentLevel === 'line' && machines) {
      return machines.map(m => ({ id: m.id, name: m.name, oee: undefined }));
    }
    return [];
  }, [drillPath.length, currentLevel, plants, lines, machines]);

  const isExecutive = hasRole('EXECUTIVE') || hasRole('ADMIN');

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        {/* Header */}
        <PageHeader 
          title="Executive Dashboard" 
          description="OEE Overview & Analysis"
          icon={BarChart3}
        >
          <Select value={dateRange} onValueChange={(v: '7' | '14' | '30') => setDateRange(v)}>
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-background">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => refetchOee()} className="bg-background">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </PageHeader>

        {/* Breadcrumb Navigation */}
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <DrillDownBreadcrumb items={drillPath} onNavigate={handleNavigate} />
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <SummaryCards
          current={oeeData?.summary || { availability: 0, performance: 0, quality: 0, oee: 0 }}
          isLoading={oeeLoading}
        />

        {/* Charts Row */}
        <div className="grid gap-5 lg:gap-6 lg:grid-cols-2">
          <OEETrendChart
            data={trendData}
            title={`OEE Trend (${dateRange} Days)`}
          />
          <ParetoChart
            data={downtimeData || []}
            title="Top Downtime Reasons"
          />
        </div>

        {/* Drill-Down Selector */}
        {drillItems.length > 0 && currentLevel !== 'machine' && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base sm:text-lg font-semibold">
                {drillPath.length === 0 ? 'Select Plant' :
                 currentLevel === 'plant' ? 'Select Line' :
                 currentLevel === 'line' ? 'Select Machine' : 'Shifts'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <DrillDownSelector
                level={drillPath.length === 0 ? 'plant' : 
                       currentLevel === 'plant' ? 'line' : 
                       currentLevel === 'line' ? 'machine' : 'shift'}
                items={drillItems}
                onSelect={(id) => {
                  const item = drillItems.find(i => i.id === id);
                  if (item) handleDrillDown(id, item.name);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Shift Details (when at machine level) */}
        {currentLevel === 'machine' && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-base sm:text-lg font-semibold">Shift History</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="text-muted-foreground text-center py-12">
                Select a shift from the Supervisor Dashboard to view details
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
