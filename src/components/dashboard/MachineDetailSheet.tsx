 import { useState } from 'react';
 import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
 import { Skeleton } from '@/components/ui/skeleton';
 import { useQuery } from '@tanstack/react-query';
 import { getMachineOEEHistory, getMachineById } from '@/services/oeeApi';
import { getMachineDowntimeBreakdown, type DowntimeBreakdown } from '@/services/oeeApi';
import { exportToCSV, exportToExcel, formatOEEForExport } from '@/lib/exportUtils';
 import { cn } from '@/lib/utils';
 import { format } from 'date-fns';
import { Play, Pause, AlertTriangle, Wrench, TrendingUp, TrendingDown, Minus, Clock, Calendar, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
 import {
   Area,
   AreaChart,
   CartesianGrid,
   ResponsiveContainer,
   Tooltip,
   XAxis,
   YAxis,
 } from 'recharts';
import { Bar, BarChart, Cell } from 'recharts';
 
 interface MachineDetailSheetProps {
   machineId: string | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const statusConfig = {
   running: {
     label: 'Running',
     icon: Play,
     bgClass: 'bg-status-running/10',
     textClass: 'text-status-running',
     dotClass: 'bg-status-running',
   },
   idle: {
     label: 'Idle',
     icon: Pause,
     bgClass: 'bg-status-idle/10',
     textClass: 'text-status-idle',
     dotClass: 'bg-status-idle',
   },
   stopped: {
     label: 'Stopped',
     icon: AlertTriangle,
     bgClass: 'bg-status-stopped/10',
     textClass: 'text-status-stopped',
     dotClass: 'bg-status-stopped',
   },
   maintenance: {
     label: 'Maintenance',
     icon: Wrench,
     bgClass: 'bg-status-maintenance/10',
     textClass: 'text-status-maintenance',
     dotClass: 'bg-status-maintenance',
   },
 };
 
 export function MachineDetailSheet({ machineId, open, onOpenChange }: MachineDetailSheetProps) {
   const [period, setPeriod] = useState<'7d' | '30d'>('7d');
 
   // Fetch machine details
   const { data: machine, isLoading: isLoadingMachine } = useQuery({
     queryKey: ['machineDetail', machineId],
     queryFn: () => getMachineById(machineId!),
     enabled: !!machineId && open,
   });
 
   // Fetch OEE history
   const { data: oeeHistory, isLoading: isLoadingHistory } = useQuery({
     queryKey: ['machineOEEHistory', machineId, period],
     queryFn: () => getMachineOEEHistory(machineId!, period === '7d' ? 7 : 30),
     enabled: !!machineId && open,
   });
 
  // Fetch downtime breakdown
  const { data: downtimeBreakdown, isLoading: isLoadingDowntime } = useQuery({
    queryKey: ['machineDowntimeBreakdown', machineId, period],
    queryFn: () => getMachineDowntimeBreakdown(machineId!, period === '7d' ? 7 : 30),
    enabled: !!machineId && open,
  });

  const isLoading = isLoadingMachine || isLoadingHistory || isLoadingDowntime;
 
   // Calculate current OEE from latest snapshot
   const latestOEE = oeeHistory?.snapshots?.[0];
   const previousOEE = oeeHistory?.snapshots?.[1];
 
   const getTrend = (current?: number, previous?: number) => {
     if (current === undefined || previous === undefined) return null;
     const diff = current - previous;
     if (Math.abs(diff) < 0.5) return { icon: Minus, color: 'text-muted-foreground', value: 0 };
     if (diff > 0) return { icon: TrendingUp, color: 'text-status-running', value: diff };
     return { icon: TrendingDown, color: 'text-status-stopped', value: diff };
   };
 
   const oeeTrend = getTrend(latestOEE?.oee, previousOEE?.oee);

  // Downtime chart colors by category
  const categoryColors: Record<string, string> = {
    PLANNED: 'hsl(var(--status-idle))',
    UNPLANNED: 'hsl(var(--status-stopped))',
    BREAKDOWN: 'hsl(var(--destructive))',
    CHANGEOVER: 'hsl(var(--status-maintenance))',
  };

  // Format downtime data for chart
  const downtimeChartData = (downtimeBreakdown || []).slice(0, 8).map((item) => ({
    name: item.reason_name.length > 15 ? item.reason_name.substring(0, 15) + '...' : item.reason_name,
    fullName: item.reason_name,
    code: item.reason_code,
    minutes: item.total_minutes,
    hours: Math.round(item.total_minutes / 60 * 10) / 10,
    count: item.event_count,
    category: item.category,
    color: categoryColors[item.category] || 'hsl(var(--muted-foreground))',
  }));

  const totalDowntimeMinutes = (downtimeBreakdown || []).reduce((sum, d) => sum + d.total_minutes, 0);
 
  // Export handlers
  const handleExportCSV = () => {
    if (!oeeHistory?.snapshots?.length || !machine) {
      toast.error('No data to export');
      return;
    }
    const exportData = formatOEEForExport(oeeHistory.snapshots);
    const filename = `${machine.code}_OEE_${period}_${format(new Date(), 'yyyyMMdd')}`;
    exportToCSV(exportData, filename);
    toast.success('CSV file downloaded');
  };

  const handleExportExcel = () => {
    if (!oeeHistory?.snapshots?.length || !machine) {
      toast.error('No data to export');
      return;
    }
    const exportData = formatOEEForExport(oeeHistory.snapshots);
    const filename = `${machine.code}_OEE_${period}_${format(new Date(), 'yyyyMMdd')}`;
    exportToExcel(exportData, filename, `${machine.name} OEE`);
    toast.success('Excel file downloaded');
  };

   // Format chart data
   const chartData = (oeeHistory?.snapshots || [])
     .slice()
     .reverse()
     .map(snap => ({
       date: format(new Date(snap.period_start), 'MMM d'),
       fullDate: format(new Date(snap.period_start), 'MMM d, yyyy HH:mm'),
       oee: Math.round((snap.oee || 0) * 10) / 10,
       availability: Math.round((snap.availability || 0) * 10) / 10,
       performance: Math.round((snap.performance || 0) * 10) / 10,
       quality: Math.round((snap.quality || 0) * 10) / 10,
     }));
 
   return (
     <Sheet open={open} onOpenChange={onOpenChange}>
       <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
         <SheetHeader className="pb-4">
           {isLoading ? (
             <>
               <Skeleton className="h-6 w-48" />
               <Skeleton className="h-4 w-32 mt-1" />
             </>
           ) : (
             <>
               <SheetTitle className="flex items-center gap-2">
                 {machine?.name}
                 <Badge variant="outline" className="font-mono text-xs">
                   {machine?.code}
                 </Badge>
               </SheetTitle>
              <div className="flex items-center justify-between">
                <SheetDescription>
                  {machine?.line?.name} • {machine?.line?.plant?.name}
                </SheetDescription>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
             </>
           )}
         </SheetHeader>
 
         <div className="space-y-6">
           {/* Current OEE Summary */}
           <div className="grid grid-cols-2 gap-4">
             {isLoading ? (
               <>
                 <Skeleton className="h-24 rounded-lg" />
                 <Skeleton className="h-24 rounded-lg" />
               </>
             ) : (
               <>
                 <Card className="border-l-4 border-l-oee-overall">
                   <CardContent className="p-4">
                     <div className="flex items-center justify-between">
                       <div>
                         <p className="text-xs text-muted-foreground">Current OEE</p>
                         <p className="text-2xl font-bold text-oee-overall">
                           {latestOEE?.oee?.toFixed(1) || '0.0'}%
                         </p>
                       </div>
                       {oeeTrend && (
                         <div className={cn('flex items-center gap-1 text-sm', oeeTrend.color)}>
                           <oeeTrend.icon className="h-4 w-4" />
                           <span>{oeeTrend.value > 0 ? '+' : ''}{oeeTrend.value.toFixed(1)}%</span>
                         </div>
                       )}
                     </div>
                   </CardContent>
                 </Card>
 
                 <Card>
                   <CardContent className="p-4">
                     <p className="text-xs text-muted-foreground mb-2">Latest Shift</p>
                     <div className="flex items-center gap-2 text-sm">
                       <Calendar className="h-4 w-4 text-muted-foreground" />
                       <span>
                         {latestOEE?.period_start
                           ? format(new Date(latestOEE.period_start), 'MMM d, yyyy')
                           : 'No data'}
                       </span>
                     </div>
                     <div className="flex items-center gap-2 text-sm mt-1">
                       <Clock className="h-4 w-4 text-muted-foreground" />
                       <span>
                         {latestOEE?.period_start
                           ? format(new Date(latestOEE.period_start), 'HH:mm')
                           : '--:--'}
                       </span>
                     </div>
                   </CardContent>
                 </Card>
               </>
             )}
           </div>
 
           {/* OEE Components */}
           <div className="grid grid-cols-3 gap-3">
             {isLoading ? (
               <>
                 <Skeleton className="h-20 rounded-lg" />
                 <Skeleton className="h-20 rounded-lg" />
                 <Skeleton className="h-20 rounded-lg" />
               </>
             ) : (
               <>
                 <Card className="border-t-2 border-t-oee-availability">
                   <CardContent className="p-3 text-center">
                     <p className="text-xs text-muted-foreground">Availability</p>
                     <p className="text-lg font-bold text-oee-availability">
                       {latestOEE?.availability?.toFixed(1) || '0.0'}%
                     </p>
                   </CardContent>
                 </Card>
                 <Card className="border-t-2 border-t-oee-performance">
                   <CardContent className="p-3 text-center">
                     <p className="text-xs text-muted-foreground">Performance</p>
                     <p className="text-lg font-bold text-oee-performance">
                       {latestOEE?.performance?.toFixed(1) || '0.0'}%
                     </p>
                   </CardContent>
                 </Card>
                 <Card className="border-t-2 border-t-oee-quality">
                   <CardContent className="p-3 text-center">
                     <p className="text-xs text-muted-foreground">Quality</p>
                     <p className="text-lg font-bold text-oee-quality">
                       {latestOEE?.quality?.toFixed(1) || '0.0'}%
                     </p>
                   </CardContent>
                 </Card>
               </>
             )}
           </div>
 
           {/* Production Stats */}
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium">Production Summary</CardTitle>
             </CardHeader>
             <CardContent className="grid grid-cols-2 gap-4">
               {isLoading ? (
                 <>
                   <Skeleton className="h-12" />
                   <Skeleton className="h-12" />
                   <Skeleton className="h-12" />
                   <Skeleton className="h-12" />
                 </>
               ) : (
                 <>
                   <div>
                     <p className="text-xs text-muted-foreground">Good Qty</p>
                     <p className="text-lg font-semibold text-status-running">
                       {latestOEE?.good_qty?.toLocaleString() || 0}
                     </p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Reject Qty</p>
                     <p className="text-lg font-semibold text-status-stopped">
                       {latestOEE?.reject_qty?.toLocaleString() || 0}
                     </p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Run Time</p>
                     <p className="text-lg font-semibold">
                       {latestOEE?.run_time_minutes || 0} min
                     </p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Downtime</p>
                     <p className="text-lg font-semibold text-status-idle">
                       {latestOEE?.downtime_minutes || 0} min
                     </p>
                   </div>
                 </>
               )}
             </CardContent>
           </Card>
 
           {/* OEE History Chart */}
           <Card>
             <CardHeader className="pb-2">
               <div className="flex items-center justify-between">
                 <CardTitle className="text-sm font-medium">OEE History</CardTitle>
                 <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
                   <TabsList className="h-8">
                     <TabsTrigger value="7d" className="text-xs px-2 h-6">7 Days</TabsTrigger>
                     <TabsTrigger value="30d" className="text-xs px-2 h-6">30 Days</TabsTrigger>
                   </TabsList>
                 </Tabs>
               </div>
             </CardHeader>
             <CardContent>
               {isLoading ? (
                 <Skeleton className="h-48 w-full" />
               ) : chartData.length === 0 ? (
                 <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                   No OEE data available
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height={200}>
                   <AreaChart data={chartData}>
                     <defs>
                       <linearGradient id="oeeGradient" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="hsl(var(--oee-overall))" stopOpacity={0.3} />
                         <stop offset="95%" stopColor="hsl(var(--oee-overall))" stopOpacity={0} />
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                     <XAxis
                       dataKey="date"
                       tickLine={false}
                       axisLine={false}
                       tick={{ fontSize: 10 }}
                       className="fill-muted-foreground"
                     />
                     <YAxis
                       domain={[0, 100]}
                       tickLine={false}
                       axisLine={false}
                       tick={{ fontSize: 10 }}
                       className="fill-muted-foreground"
                       width={30}
                     />
                     <Tooltip
                       content={({ active, payload }) => {
                         if (!active || !payload?.length) return null;
                         const data = payload[0].payload;
                         return (
                           <div className="rounded-lg border bg-background p-3 shadow-lg">
                             <p className="text-xs text-muted-foreground mb-2">{data.fullDate}</p>
                             <div className="grid gap-1 text-sm">
                               <div className="flex justify-between gap-4">
                                 <span className="text-oee-overall">OEE:</span>
                                 <span className="font-medium">{data.oee}%</span>
                               </div>
                               <div className="flex justify-between gap-4">
                                 <span className="text-oee-availability">Availability:</span>
                                 <span className="font-medium">{data.availability}%</span>
                               </div>
                               <div className="flex justify-between gap-4">
                                 <span className="text-oee-performance">Performance:</span>
                                 <span className="font-medium">{data.performance}%</span>
                               </div>
                               <div className="flex justify-between gap-4">
                                 <span className="text-oee-quality">Quality:</span>
                                 <span className="font-medium">{data.quality}%</span>
                               </div>
                             </div>
                           </div>
                         );
                       }}
                     />
                     <Area
                       type="monotone"
                       dataKey="oee"
                       stroke="hsl(var(--oee-overall))"
                       strokeWidth={2}
                       fill="url(#oeeGradient)"
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
             </CardContent>
           </Card>
 
          {/* Downtime Breakdown Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Downtime Breakdown</CardTitle>
                {totalDowntimeMinutes > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Total: {Math.floor(totalDowntimeMinutes / 60)}h {totalDowntimeMinutes % 60}m
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : downtimeChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No downtime data available
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={downtimeChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        className="fill-muted-foreground"
                        tickFormatter={(val) => `${val}m`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        className="fill-muted-foreground"
                        width={100}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                              <p className="text-sm font-medium mb-1">{data.fullName}</p>
                              <p className="text-xs text-muted-foreground mb-2">Code: {data.code}</p>
                              <div className="grid gap-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Duration:</span>
                                  <span className="font-medium">{data.minutes} min ({data.hours}h)</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Occurrences:</span>
                                  <span className="font-medium">{data.count}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Category:</span>
                                  <Badge variant="outline" className="text-xs">{data.category}</Badge>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                        {downtimeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {Object.entries(categoryColors).map(([category, color]) => (
                      <div key={category} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-muted-foreground capitalize">{category.toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

           {/* Shift History List */}
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium">Recent Shifts</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2 max-h-64 overflow-y-auto">
               {isLoading ? (
                 <>
                   <Skeleton className="h-14" />
                   <Skeleton className="h-14" />
                   <Skeleton className="h-14" />
                 </>
               ) : (oeeHistory?.snapshots || []).length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-4">
                   No shift data available
                 </p>
               ) : (
                 (oeeHistory?.snapshots || []).slice(0, 10).map((snap, index) => (
                   <div
                     key={snap.id}
                     className={cn(
                       'flex items-center justify-between p-3 rounded-lg border',
                       index === 0 && 'bg-accent/50'
                     )}
                   >
                     <div>
                       <p className="text-sm font-medium">
                         {format(new Date(snap.period_start), 'MMM d, yyyy')}
                       </p>
                       <p className="text-xs text-muted-foreground">
                         {format(new Date(snap.period_start), 'HH:mm')} - {format(new Date(snap.period_end), 'HH:mm')}
                       </p>
                     </div>
                     <div className="text-right">
                       <p
                         className={cn(
                           'text-lg font-bold',
                           (snap.oee || 0) >= 85 ? 'text-status-running' :
                           (snap.oee || 0) >= 60 ? 'text-status-idle' : 'text-status-stopped'
                         )}
                       >
                         {snap.oee?.toFixed(1) || '0.0'}%
                       </p>
                       <p className="text-xs text-muted-foreground">
                         A:{snap.availability?.toFixed(0)}% P:{snap.performance?.toFixed(0)}% Q:{snap.quality?.toFixed(0)}%
                       </p>
                     </div>
                   </div>
                 ))
               )}
             </CardContent>
           </Card>
         </div>
       </SheetContent>
     </Sheet>
   );
 }