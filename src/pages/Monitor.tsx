import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { MonitorMachineCard } from '@/components/monitor/MonitorMachineCard';
import { MonitorControlSheet } from '@/components/monitor/MonitorControlSheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useMonitorData } from '@/hooks/useMonitorData';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenToggle, FullscreenContainer } from '@/components/ui/FullscreenToggle';
import { useQuery } from '@tanstack/react-query';
import { getLines, getPlants } from '@/services/oeeApi';
import {
  Monitor as MonitorIcon,
  Play,
  Pause,
  AlertTriangle,
  Wrench,
  Factory,
  Building2,
  Wifi,
  MapPin,
} from 'lucide-react';

type StatusFilter = 'all' | 'running' | 'idle' | 'stopped' | 'maintenance';

export default function MonitorPage() {
  const { company, isAdmin } = useAuth();
  const { data, isLoading } = useMonitorData();
  const { isFullscreen, isKiosk, toggleFullscreen, enterKiosk, enterFullscreen } = useFullscreen();
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [controlSheetOpen, setControlSheetOpen] = useState(false);

  const companyId = company?.id;

  const { data: plants } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => getPlants(companyId),
    enabled: !!companyId || !isAdmin(),
  });

  const { data: lines } = useQuery({
    queryKey: ['lines', companyId],
    queryFn: () => getLines(undefined, companyId),
    enabled: !!companyId || !isAdmin(),
  });

  // Filter lines based on selected plant
  const filteredLines = useMemo(() => {
    if (!lines) return [];
    if (selectedPlant === 'all') return lines;
    return lines.filter(l => l.plant_id === selectedPlant);
  }, [lines, selectedPlant]);

  // Reset line filter when plant changes
  const handlePlantChange = (plantId: string) => {
    setSelectedPlant(plantId);
    setSelectedLine('all');
  };

  // Filter machines
  const filteredMachines = useMemo(() => {
    if (!data?.machines) return [];
    let result = data.machines;
    if (selectedPlant !== 'all') {
      result = result.filter(m => m.plant_id === selectedPlant);
    }
    if (selectedLine !== 'all') {
      result = result.filter(m => m.line_id === selectedLine);
    }
    if (statusFilter !== 'all') {
      result = result.filter(m => m.status === statusFilter);
    }
    return result;
  }, [data?.machines, selectedPlant, selectedLine, statusFilter]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const stats = { running: 0, idle: 0, stopped: 0, maintenance: 0, total: 0 };
    for (const m of filteredMachines) {
      stats[m.status]++;
      stats.total++;
    }
    return stats;
  }, [filteredMachines]);

  const stats = filteredStats;

  // Group machines by line
  const machinesByLine = useMemo(() => {
    const map = new Map<string, { lineId: string; lineName: string; plantName?: string; machines: typeof filteredMachines }>();
    for (const m of filteredMachines) {
      const key = m.line_id;
      if (!map.has(key)) {
        map.set(key, { lineId: key, lineName: m.line_name || 'Unknown Line', plantName: m.plant_name, machines: [] });
      }
      map.get(key)!.machines.push(m);
    }
    // Sort lines alphabetically
    return [...map.values()].sort((a, b) => a.lineName.localeCompare(b.lineName));
  }, [filteredMachines]);

  const content = (
    <div className="page-container space-y-5">
      {/* Header */}
      <PageHeader
        title="Production Monitor"
        description="สถานะเครื่องจักรแบบ Real-time"
        icon={MonitorIcon}
      >
        {!isKiosk && (
          <FullscreenToggle
            isFullscreen={isFullscreen}
            isKiosk={isKiosk}
            onToggle={toggleFullscreen}
            onEnterKiosk={enterKiosk}
            onEnterFullscreen={enterFullscreen}
          />
        )}

        {/* Realtime indicator */}
        <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-medium border-status-running/30 text-status-running bg-status-running/5">
          <Wifi className="h-3 w-3 animate-pulse" />
          Live
        </Badge>

        {!isKiosk && isAdmin() && company && (
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 border-primary/20">
            <Building2 className="h-3.5 w-3.5" />
            {company.name}
          </Badge>
        )}

        {!isKiosk && (
          <>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px] bg-background border-border/50">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="running">🟢 Running</SelectItem>
                <SelectItem value="stopped">🔴 Stopped</SelectItem>
                <SelectItem value="maintenance">🟡 Setup</SelectItem>
                <SelectItem value="idle">⚪ Idle</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPlant} onValueChange={handlePlantChange}>
              <SelectTrigger className="w-[160px] bg-background border-border/50">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="เลือกโรงงาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกโรงงาน</SelectItem>
                {plants?.map(plant => (
                  <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLine} onValueChange={setSelectedLine}>
              <SelectTrigger className="w-[160px] bg-background border-border/50">
                <Factory className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="เลือกไลน์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกไลน์</SelectItem>
                {filteredLines?.map(line => (
                  <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </PageHeader>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={Play} label="Running" count={stats.running} colorClass="text-status-running" bgClass="bg-status-running/10" />
        <StatPill icon={AlertTriangle} label="Stopped" count={stats.stopped} colorClass="text-status-stopped" bgClass="bg-status-stopped/10" />
        <StatPill icon={Wrench} label="Setup" count={stats.maintenance} colorClass="text-status-maintenance" bgClass="bg-status-maintenance/10" />
        <StatPill icon={Pause} label="Idle" count={stats.idle} colorClass="text-status-idle" bgClass="bg-status-idle/10" />
      </div>

      {/* Machine Grid - Grouped by Line */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-40 rounded" />
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-40 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredMachines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MonitorIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>ไม่พบเครื่องจักร{statusFilter !== 'all' ? ` ในสถานะ ${statusFilter}` : ''}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {machinesByLine.map(({ lineId, lineName, plantName, machines: lineMachines }) => {
            const lineStats = { running: 0, stopped: 0, maintenance: 0, idle: 0 };
            for (const m of lineMachines) lineStats[m.status]++;
            return (
              <div key={lineId} className="rounded-xl border bg-card/50 overflow-hidden">
                {/* Line Header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Factory className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{lineName}</span>
                    {plantName && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        <MapPin className="inline h-3 w-3 mr-0.5 -mt-0.5" />{plantName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lineStats.running > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-status-running/10 text-status-running border-0">
                        {lineStats.running} Running
                      </Badge>
                    )}
                    {lineStats.stopped > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-status-stopped/10 text-status-stopped border-0">
                        {lineStats.stopped} Stopped
                      </Badge>
                    )}
                    {lineStats.maintenance > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-status-maintenance/10 text-status-maintenance border-0">
                        {lineStats.maintenance} Setup
                      </Badge>
                    )}
                    {lineStats.idle > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-status-idle/10 text-status-idle border-0">
                        {lineStats.idle} Idle
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Machines in this line */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 p-3">
                  {lineMachines.map(machine => (
                    <MonitorMachineCard
                      key={machine.id}
                      machine={machine}
                      onClick={() => {
                        setSelectedMachineId(machine.id);
                        setControlSheetOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Control Sheet */}
      {selectedMachineId && (() => {
        const selectedMachine = data?.machines.find(m => m.id === selectedMachineId);
        return (
          <MonitorControlSheet
            machineId={selectedMachineId}
            machineName={selectedMachine?.name}
            machineCode={selectedMachine?.code}
            machineStatus={selectedMachine?.status}
            open={controlSheetOpen}
            onOpenChange={setControlSheetOpen}
          />
        );
      })()}
    </div>
  );

  if (isFullscreen || isKiosk) {
    return (
      <FullscreenContainer isFullscreen={isFullscreen} isKiosk={isKiosk}>
        {content}
      </FullscreenContainer>
    );
  }

  return <AppLayout>{content}</AppLayout>;
}

// Small stat pill component
function StatPill({
  icon: Icon,
  label,
  count,
  colorClass,
  bgClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', bgClass, 'border-transparent')}>
      <Icon className={cn('h-5 w-5', colorClass)} />
      <div>
        <p className={cn('text-2xl font-bold tabular-nums', colorClass)}>{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
