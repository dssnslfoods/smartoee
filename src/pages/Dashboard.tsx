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
       <div className="page-container space-y-6 dark">
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
             <SelectTrigger className="w-[140px] sm:w-[160px] bg-background border-border/50">
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
             <SelectTrigger className="w-[140px] sm:w-[160px] bg-background border-border/50">
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
 
         {/* OEE Summary Cards - Racing Speedometer Style */}
         <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-2 md:grid-cols-4">
           {isLoading ? (
             <>
               <OEECardSkeleton />
               <OEECardSkeleton />
               <OEECardSkeleton />
               <OEECardSkeleton />
             </>
           ) : (
             <>
               <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-oee-availability/5 border-oee-availability/30 shadow-[0_0_20px_-5px_hsl(var(--oee-availability)/0.3)] hover:shadow-[0_0_30px_-5px_hsl(var(--oee-availability)/0.5)] transition-shadow">
                 <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center">
                   <OEEGauge value={oee.availability} label="Availability" color="availability" size="sm" />
                 </CardContent>
               </Card>
 
               <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-oee-performance/5 border-oee-performance/30 shadow-[0_0_20px_-5px_hsl(var(--oee-performance)/0.3)] hover:shadow-[0_0_30px_-5px_hsl(var(--oee-performance)/0.5)] transition-shadow">
                 <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center">
                   <OEEGauge value={oee.performance} label="Performance" color="performance" size="sm" />
                 </CardContent>
               </Card>
 
               <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-oee-quality/5 border-oee-quality/30 shadow-[0_0_20px_-5px_hsl(var(--oee-quality)/0.3)] hover:shadow-[0_0_30px_-5px_hsl(var(--oee-quality)/0.5)] transition-shadow">
                 <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center">
                   <OEEGauge value={oee.quality} label="Quality" color="quality" size="sm" />
                 </CardContent>
               </Card>
 
               <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-oee-overall/10 border-oee-overall/40 shadow-[0_0_25px_-5px_hsl(var(--oee-overall)/0.4)] hover:shadow-[0_0_35px_-5px_hsl(var(--oee-overall)/0.6)] transition-shadow">
                 <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center">
                   <OEEGauge value={oee.oee} label="Overall OEE" color="overall" size="sm" />
                 </CardContent>
               </Card>
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
               <OEETrendChart data={trend} title="Weekly OEE Trend" />
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
     </AppLayout>
   );
 }