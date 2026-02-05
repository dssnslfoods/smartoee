import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { OEEGauge } from '@/components/dashboard/OEEGauge';
import { MachineStatusCard } from '@/components/dashboard/MachineStatusCard';
import { MachineDetailSheet } from '@/components/dashboard/MachineDetailSheet';
import { OEETrendChart } from '@/components/dashboard/OEETrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OEECardSkeleton, StatsCardSkeleton, MachineCardSkeleton, ChartCardSkeleton } from '@/components/ui/skeletons';
import { Calendar, Factory, AlertTriangle, LayoutDashboard, Play, Pause, Wrench, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getDashboardOEE, getMachinesWithStatus, getOEETrend, getLines } from '@/services/oeeApi';
import { useState, useMemo } from 'react';

export default function Dashboard() {
  const { company, isAdmin } = useAuth();
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const companyId = company?.id;
  const companyName = company?.name;

  // Fetch OEE summary data (auto-refresh every 30 seconds)
  const { data: oeeData, isLoading: isLoadingOEE } = useQuery({
    queryKey: ['dashboardOEE', companyId],
    queryFn: () => getDashboardOEE(companyId),
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
    queryKey: ['dashboardTrend', companyId],
    queryFn: () => getOEETrend(companyId),
    enabled: !!companyId || !isAdmin(),
    refetchInterval: 30000,
  });

  // Fetch lines for filter
  const { data: lines } = useQuery({
    queryKey: ['lines', companyId],
    queryFn: () => getLines(undefined, companyId),
    enabled: !!companyId || !isAdmin(),
  });

  // Filter machines by selected line
  const filteredMachines = useMemo(() => {
    if (!machineData?.machines) return [];
    if (selectedLine === 'all') return machineData.machines;
    return machineData.machines.filter(m => m.line_id === selectedLine);
  }, [machineData?.machines, selectedLine]);

  // Recalculate stats based on filtered machines
  const filteredStats = useMemo(() => {
    if (selectedLine === 'all') return machineData?.stats;
    
    const stats = { running: 0, idle: 0, stopped: 0, maintenance: 0 };
    filteredMachines.forEach(machine => {
      stats[machine.status]++;
    });
    return stats;
  }, [filteredMachines, selectedLine, machineData?.stats]);

  const stats = filteredStats || { running: 0, idle: 0, stopped: 0, maintenance: 0 };
  const oee = oeeData || { availability: 0, performance: 0, quality: 0, oee: 0 };
  const trend = trendData || [];

  const handleMachineClick = (machineId: string) => {
    setSelectedMachineId(machineId);
    setDetailSheetOpen(true);
  };

  const isLoading = isLoadingOEE || isLoadingMachines;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        {/* Header */}
        <PageHeader 
          title="OEE Dashboard" 
          description="Real-time production performance monitoring"
          icon={LayoutDashboard}
        >
          {/* Company indicator for admin users */}
          {isAdmin() && company && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 border-primary/20">
              <Building2 className="h-3.5 w-3.5" />
              {companyName}
            </Badge>
          )}
          <Select defaultValue="today">
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-background">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedLine} onValueChange={setSelectedLine}>
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-background">
              <Factory className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {lines?.map(line => (
                <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageHeader>

        {/* OEE Summary Cards */}
        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <OEECardSkeleton />
              <OEECardSkeleton />
              <OEECardSkeleton />
              <OEECardSkeleton />
            </>
          ) : (
            <>
              <Card className="relative overflow-hidden border-l-4 border-l-oee-availability">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <OEEGauge value={oee.availability} label="" color="availability" size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Availability</p>
                      <p className="text-xl sm:text-2xl font-bold text-oee-availability">
                        {oee.availability}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-l-4 border-l-oee-performance">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <OEEGauge value={oee.performance} label="" color="performance" size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Performance</p>
                      <p className="text-xl sm:text-2xl font-bold text-oee-performance">
                        {oee.performance}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-l-4 border-l-oee-quality">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <OEEGauge value={oee.quality} label="" color="quality" size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Quality</p>
                      <p className="text-xl sm:text-2xl font-bold text-oee-quality">
                        {oee.quality}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-l-4 border-l-oee-overall bg-gradient-to-br from-card to-accent/30">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <OEEGauge value={oee.oee} label="" color="overall" size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Overall OEE</p>
                      <p className="text-xl sm:text-2xl font-bold text-oee-overall">
                        {oee.oee}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <Card className="transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-running/10">
                    <Play className="h-5 w-5 sm:h-6 sm:w-6 text-status-running" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-bold">{stats.running}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Machines Running</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-idle/10">
                    <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-status-idle" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-bold">{stats.idle}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Machines Idle</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-stopped/10">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-status-stopped" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-bold">{stats.stopped}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Machines Stopped</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-maintenance/10">
                    <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-status-maintenance" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-bold">{stats.maintenance}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">In Maintenance</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts and Machine Grid */}
        <div className="grid gap-5 lg:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isLoadingTrend ? (
              <ChartCardSkeleton />
            ) : (
              <OEETrendChart data={trend} title="Weekly OEE Trend" />
            )}
          </div>
          <Card>
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
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
    </AppLayout>
  );
}