import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { OEEGauge } from '@/components/dashboard/OEEGauge';
import { MachineStatusCard } from '@/components/dashboard/MachineStatusCard';
import { MachineDetailSheet } from '@/components/dashboard/MachineDetailSheet';
import { OEETrendChart } from '@/components/dashboard/OEETrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OEECardSkeleton, StatsCardSkeleton, MachineCardSkeleton, ChartCardSkeleton } from '@/components/ui/skeletons';
import { Calendar, Factory, AlertTriangle, LayoutDashboard, Play, Pause, Wrench, Building2, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenToggle, FullscreenContainer } from '@/components/ui/FullscreenToggle';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getDashboardOEE, getMachinesWithStatus, getOEETrend, getLines, getPlants } from '@/services/oeeApi';
import { useState, useMemo, useEffect } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

type PeriodOption = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '60d';

const PERIOD_OPTIONS: { value: PeriodOption; label: string; trendDays: number }[] = [
  { value: 'today', label: 'วันนี้', trendDays: 1 },
  { value: 'yesterday', label: 'เมื่อวาน', trendDays: 1 },
  { value: '7d', label: '7 วัน', trendDays: 7 },
  { value: '14d', label: '14 วัน', trendDays: 14 },
  { value: '30d', label: '30 วัน', trendDays: 30 },
  { value: '60d', label: '60 วัน', trendDays: 60 },
];

function getDateRange(period: PeriodOption): { startDate: string; endDate: string; trendDays: number } {
  const now = new Date();
  const opt = PERIOD_OPTIONS.find(o => o.value === period)!;

  switch (period) {
    case 'today':
      return { startDate: startOfDay(now).toISOString(), endDate: endOfDay(now).toISOString(), trendDays: 7 };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return { startDate: startOfDay(yesterday).toISOString(), endDate: endOfDay(yesterday).toISOString(), trendDays: 7 };
    }
    default: {
      const start = subDays(now, opt.trendDays - 1);
      return { startDate: startOfDay(start).toISOString(), endDate: endOfDay(now).toISOString(), trendDays: opt.trendDays };
    }
  }
}

export default function Dashboard() {
  const { company, isAdmin, hasRole } = useAuth();
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('today');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const { isFullscreen, isKiosk, toggleFullscreen, enterKiosk, enterFullscreen } = useFullscreen();

  const companyId = company?.id;
  const companyName = company?.name;

  // Check if the user can use the time filter (admin, supervisor, executive)
  const canUseTimeFilter = isAdmin() || hasRole('SUPERVISOR') || hasRole('EXECUTIVE');

  // Calculate date range from selected period
  const { startDate, endDate, trendDays } = useMemo(() => getDateRange(selectedPeriod), [selectedPeriod]);

  // Fetch OEE summary data (auto-refresh every 30 seconds)
  const { data: oeeData, isLoading: isLoadingOEE } = useQuery({
    queryKey: ['dashboardOEE', companyId, startDate, endDate],
    queryFn: () => getDashboardOEE(companyId, canUseTimeFilter ? startDate : undefined, canUseTimeFilter ? endDate : undefined),
    enabled: !!companyId || !isAdmin(),
    refetchInterval: 30000,
  });

  // Fetch machines with status (auto-refresh every 30 seconds)
  const { data: machineData, isLoading: isLoadingMachines } = useQuery({
    queryKey: ['dashboardMachines', companyId],
    queryFn: () => getMachinesWithStatus(companyId),
    enabled: !!companyId || !isAdmin(),
    refetchInterval: 30000,
  });

  // Fetch OEE trend data (auto-refresh every 30 seconds)
  const { data: trendData, isLoading: isLoadingTrend } = useQuery({
    queryKey: ['dashboardTrend', companyId, trendDays],
    queryFn: () => getOEETrend(companyId, canUseTimeFilter ? trendDays : 7),
    enabled: !!companyId || !isAdmin(),
    refetchInterval: 30000,
  });

  // Fetch plants for filter
  const { data: plants } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => getPlants(companyId),
    enabled: !!companyId || !isAdmin(),
  });

  // Fetch lines for filter
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

  // Auto-select when only one option available
  useEffect(() => {
    if (plants && plants.length === 1 && selectedPlant === 'all') {
      setSelectedPlant(plants[0].id);
    }
  }, [plants, selectedPlant]);

  useEffect(() => {
    if (filteredLines.length === 1 && selectedLine === 'all') {
      setSelectedLine(filteredLines[0].id);
    }
  }, [filteredLines, selectedLine]);

  // Reset line filter when plant changes
  const handlePlantChange = (plantId: string) => {
    setSelectedPlant(plantId);
    setSelectedLine('all');
  };

  // Filter machines by selected plant and line
  const filteredMachines = useMemo(() => {
    if (!machineData?.machines) return [];
    let result = machineData.machines;
    if (selectedPlant !== 'all') {
      result = result.filter(m => m.plant_id === selectedPlant);
    }
    if (selectedLine !== 'all') {
      result = result.filter(m => m.line_id === selectedLine);
    }
    return result;
  }, [machineData?.machines, selectedPlant, selectedLine]);

  // Recalculate stats based on filtered machines
  const filteredStats = useMemo(() => {
    if (selectedPlant === 'all' && selectedLine === 'all') return machineData?.stats;
    
    const stats = { running: 0, idle: 0, stopped: 0, maintenance: 0 };
    filteredMachines.forEach(machine => {
      stats[machine.status]++;
    });
    return stats;
  }, [filteredMachines, selectedPlant, selectedLine, machineData?.stats]);

  const stats = filteredStats || { running: 0, idle: 0, stopped: 0, maintenance: 0 };
  const oee = oeeData || { availability: 0, performance: 0, quality: 0, oee: 0 };
  const trend = trendData || [];
 
   const handleMachineClick = (machineId: string) => {
     setSelectedMachineId(machineId);
     setDetailSheetOpen(true);
   };
 
   const isLoading = isLoadingOEE || isLoadingMachines;
 
   const content = (
     <div className="page-container space-y-6">
       {/* Header */}
       <PageHeader 
         title="OEE Dashboard" 
         description="Real-time production performance monitoring"
         icon={LayoutDashboard}
       >
         {/* Fullscreen Toggle - hidden in kiosk mode */}
         {!isKiosk && (
           <FullscreenToggle 
             isFullscreen={isFullscreen} 
             isKiosk={isKiosk}
             onToggle={toggleFullscreen} 
             onEnterKiosk={enterKiosk}
             onEnterFullscreen={enterFullscreen}
           />
         )}
 
         {/* Company indicator for admin users - hidden in kiosk mode */}
         {!isKiosk && isAdmin() && company && (
           <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 border-primary/20">
             <Building2 className="h-3.5 w-3.5" />
             {companyName}
           </Badge>
         )}
         {/* Filters - hidden in kiosk mode */}
          {!isKiosk && (
            <>
              {canUseTimeFilter && (
                <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as PeriodOption)}>
                  <SelectTrigger className="w-[140px] sm:w-[160px] bg-background border-border/50">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="เลือกช่วงเวลา" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={selectedPlant} onValueChange={handlePlantChange}>
                <SelectTrigger className="w-[140px] sm:w-[160px] bg-background border-border/50">
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  {plants?.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
             <Select value={selectedLine} onValueChange={setSelectedLine}>
               <SelectTrigger className="w-[140px] sm:w-[160px] bg-background border-border/50">
                 <Factory className="mr-2 h-4 w-4 text-muted-foreground" />
                 <SelectValue placeholder="Select line" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Lines</SelectItem>
                 {filteredLines?.map(line => (
                   <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </>
         )}
       </PageHeader>
 
       {/* Main OEE Gauge - Hero Section */}
       <div className="flex flex-col items-center justify-center py-4 sm:py-6">
         {isLoading ? (
           <OEECardSkeleton />
         ) : (
           <div className="relative">
             {/* Glow backdrop */}
             <div className="absolute inset-0 blur-3xl opacity-30 bg-oee-overall rounded-full scale-75" />
             <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-oee-overall/10 border-oee-overall/40 shadow-[0_0_60px_-10px_hsl(var(--oee-overall)/0.5)] p-6 sm:p-8">
               <CardContent className="p-0 flex flex-col items-center justify-center">
                 <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-2">Overall Equipment Effectiveness</p>
                 <OEEGauge value={oee.oee} label="" color="overall" size="lg" />
                 <p className="text-lg sm:text-xl font-bold text-foreground mt-3">
                   {oee.oee >= 85 ? '🏆 World Class' : oee.oee >= 60 ? '✓ Acceptable' : '⚠ Needs Improvement'}
                 </p>
               </CardContent>
             </Card>
           </div>
         )}
       </div>
 
       {/* OEE Component Gauges - A P Q */}
       <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-3">
         {isLoading ? (
           <>
             <OEECardSkeleton />
             <OEECardSkeleton />
             <OEECardSkeleton />
           </>
         ) : (
           <>
              <div className="flex flex-col items-center">
                <OEEGauge value={oee.availability} label="Availability" color="availability" size="md" />
              </div>
              <div className="flex flex-col items-center">
                <OEEGauge value={oee.performance} label="Performance" color="performance" size="md" />
              </div>
              <div className="flex flex-col items-center">
                <OEEGauge value={oee.quality} label="Quality" color="quality" size="md" />
              </div>
           </>
         )}
       </div>
 
       {/* Quick Stats - Racing HUD Style */}
       <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
         {isLoading ? (
           <>
             <StatsCardSkeleton />
             <StatsCardSkeleton />
             <StatsCardSkeleton />
             <StatsCardSkeleton />
           </>
         ) : (
           <>
             <Card className="transition-all hover:shadow-[0_0_20px_-5px_hsl(var(--status-running)/0.4)] border-status-running/20 bg-gradient-to-br from-card to-status-running/5">
               <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                 <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-running/10 shadow-[0_0_15px_-3px_hsl(var(--status-running)/0.5)]">
                   <Play className="h-5 w-5 sm:h-6 sm:w-6 text-status-running" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-2xl sm:text-3xl font-bold tabular-nums text-status-running">{stats.running}</p>
                   <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Running</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="transition-all hover:shadow-[0_0_20px_-5px_hsl(var(--status-idle)/0.4)] border-status-idle/20 bg-gradient-to-br from-card to-status-idle/5">
               <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                 <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-idle/10 shadow-[0_0_15px_-3px_hsl(var(--status-idle)/0.5)]">
                   <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-status-idle" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-2xl sm:text-3xl font-bold tabular-nums text-status-idle">{stats.idle}</p>
                   <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Idle</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="transition-all hover:shadow-[0_0_20px_-5px_hsl(var(--status-stopped)/0.4)] border-status-stopped/20 bg-gradient-to-br from-card to-status-stopped/5">
               <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                 <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-stopped/10 shadow-[0_0_15px_-3px_hsl(var(--status-stopped)/0.5)]">
                   <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-status-stopped" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-2xl sm:text-3xl font-bold tabular-nums text-status-stopped">{stats.stopped}</p>
                   <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Stopped</p>
                 </div>
               </CardContent>
             </Card>
             <Card className="transition-all hover:shadow-[0_0_20px_-5px_hsl(var(--status-maintenance)/0.4)] border-status-maintenance/20 bg-gradient-to-br from-card to-status-maintenance/5">
               <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                 <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-maintenance/10 shadow-[0_0_15px_-3px_hsl(var(--status-maintenance)/0.5)]">
                   <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-status-maintenance" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-2xl sm:text-3xl font-bold tabular-nums text-status-maintenance">{stats.maintenance}</p>
                   <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">Maintenance</p>
                 </div>
               </CardContent>
             </Card>
           </>
         )}
       </div>
 
       {/* Charts and Machine Grid */}
       <div className="grid gap-4 md:gap-5 lg:gap-6 md:grid-cols-2 lg:grid-cols-3">
         <div className="md:col-span-2 lg:col-span-2">
           {isLoadingTrend ? (
             <ChartCardSkeleton />
           ) : (
              <OEETrendChart data={trend} title={`OEE Trend (${PERIOD_OPTIONS.find(o => o.value === selectedPeriod)?.label || '7 วัน'})`} />
           )}
         </div>
         <Card className="border-border/50">
           <CardHeader className="pb-3">
             <CardTitle className="text-base sm:text-lg font-semibold">Machine Status</CardTitle>
           </CardHeader>
           <CardContent className="space-y-3">
             {isLoadingMachines ? (
               <>
                 <MachineCardSkeleton />
                 <MachineCardSkeleton />
                 <MachineCardSkeleton />
                 <MachineCardSkeleton />
               </>
             ) : filteredMachines.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">No machines found</p>
             ) : (
               filteredMachines.slice(0, 4).map((machine) => (
                 <MachineStatusCard 
                   key={machine.id} 
                   name={machine.name}
                   code={machine.code}
                   status={machine.status}
                   oee={machine.oee}
                   currentProduct={machine.currentProduct}
                   compact 
                   onClick={() => handleMachineClick(machine.id)}
                 />
               ))
             )}
           </CardContent>
         </Card>
       </div>
 
       {/* All Machines Grid */}
       <div>
         <h2 className="text-lg font-semibold mb-4">All Machines</h2>
         {isLoadingMachines ? (
           <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
             <MachineCardSkeleton />
             <MachineCardSkeleton />
             <MachineCardSkeleton />
             <MachineCardSkeleton />
             <MachineCardSkeleton />
             <MachineCardSkeleton />
           </div>
         ) : filteredMachines.length === 0 ? (
           <Card>
             <CardContent className="py-8 text-center text-muted-foreground">
               No machines found for this company
             </CardContent>
           </Card>
         ) : (
           <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
             {filteredMachines.map((machine) => (
               <MachineStatusCard 
                 key={machine.id}
                 name={machine.name}
                 code={machine.code}
                 status={machine.status}
                 oee={machine.oee}
                 currentProduct={machine.currentProduct}
                 onClick={() => handleMachineClick(machine.id)}
               />
             ))}
           </div>
         )}
       </div>
 
       {/* Machine Detail Sheet */}
       <MachineDetailSheet
         machineId={selectedMachineId}
         open={detailSheetOpen}
         onOpenChange={setDetailSheetOpen}
       />
     </div>
   );
 
   if (isFullscreen) {
     return (
       <FullscreenContainer isFullscreen={isFullscreen} isKiosk={isKiosk}>
         {content}
       </FullscreenContainer>
     );
   }
 
   return (
     <AppLayout>
       {content}
     </AppLayout>
   );
 }