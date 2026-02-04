import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, RefreshCw, CalendarIcon, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { OEEMetricsPanel } from '@/components/supervisor/OEEMetricsPanel';
import { ApprovalControls } from '@/components/supervisor/ApprovalControls';
import { AuditLogViewer } from '@/components/supervisor/AuditLogViewer';
import { StaffManager } from '@/components/supervisor/StaffManager';
import { PermissionGroupManager } from '@/components/supervisor/PermissionGroupManager';
import oeeApi from '@/services/oeeApi';

export default function Supervisor() {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined); // undefined = show recent shifts

  // Calculate date range - if date selected, use only that date; otherwise fetch recent range
  const dateRange = useMemo(() => {
    const today = new Date();
    if (selectedDate) {
      // If date is selected, only fetch that date
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return { startDate: dateStr, endDate: dateStr };
    } else {
      // Default: fetch last 2 days and next 2 days to cover ~6 shifts
      const startDate = format(subDays(today, 2), 'yyyy-MM-dd');
      const endDate = format(addDays(today, 2), 'yyyy-MM-dd');
      return { startDate, endDate };
    }
  }, [selectedDate]);

  // Fetch plants
  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => oeeApi.getPlants(),
  });

  // Fetch shift summaries for selected plant and date range
  const { data: shiftSummaries = [], isLoading: loadingSummaries, refetch: refetchSummaries } = useQuery({
    queryKey: ['shiftSummaries', selectedPlantId, dateRange.startDate, dateRange.endDate],
    queryFn: () => oeeApi.getShiftSummaries(selectedPlantId, dateRange.startDate, dateRange.endDate),
    enabled: !!selectedPlantId,
  });

  // Filter to show only ~3 before and ~3 after current time when no date is selected
  const filteredSummaries = useMemo(() => {
    if (selectedDate || shiftSummaries.length <= 6) {
      return shiftSummaries;
    }
    
    // Find the closest shift to now and show 3 before + 3 after
    const now = new Date();
    const nowStr = format(now, 'yyyy-MM-dd');
    
    // Sort by date descending (already sorted)
    // Find the index of the current/closest shift
    let currentIdx = shiftSummaries.findIndex(s => s.shift_date === nowStr);
    if (currentIdx === -1) {
      // If today not found, find the first date that's before today
      currentIdx = shiftSummaries.findIndex(s => s.shift_date && s.shift_date < nowStr);
      if (currentIdx === -1) currentIdx = 0;
    }
    
    // Take 3 before (which are newer in descending order) and 3 after (older)
    const start = Math.max(0, currentIdx - 3);
    const end = Math.min(shiftSummaries.length, currentIdx + 4);
    
    return shiftSummaries.slice(start, end);
  }, [shiftSummaries, selectedDate]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (shiftCalendarId: string) => {
      const result = await oeeApi.approveShift(shiftCalendarId);
      if (!result.success) {
        throw new Error(result.message || 'Failed to approve shift');
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'อนุมัติกะเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries'] });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Lock mutation
  const lockMutation = useMutation({
    mutationFn: async (shiftCalendarId: string) => {
      const result = await oeeApi.lockShift(shiftCalendarId);
      if (!result.success) {
        throw new Error(result.message || 'Failed to lock shift');
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ล็อคกะเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries'] });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  // Recalc OEE mutation
  const recalcMutation = useMutation({
    mutationFn: async (shiftCalendarId: string) => {
      const result = await oeeApi.recalcOeeForShift(shiftCalendarId);
      if (!result.success) {
        throw new Error(result.message || 'Failed to recalculate OEE');
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'คำนวณ OEE ใหม่เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries'] });
    },
    onError: (error: Error) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    },
  });

  const isSupervisor = hasRole('SUPERVISOR') || hasRole('ADMIN');

  // Redirect or show message if user is not a supervisor
  if (!isSupervisor) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lock className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
              <p className="text-muted-foreground">
                หน้านี้สำหรับ Supervisor และ Admin เท่านั้น
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Supervisor Dashboard</h1>
            <p className="text-muted-foreground">จัดการและปิดกะ</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Plant Selector */}
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="เลือกโรงงาน" />
              </SelectTrigger>
              <SelectContent>
                {plants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Selector with Calendar */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, 'd MMM yyyy', { locale: th })
                  ) : (
                    <span>กะล่าสุด (±3 กะ)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            {/* Clear date filter button */}
            {selectedDate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDate(undefined)}
                title="ล้างวันที่"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchSummaries()}
              disabled={loadingSummaries}
            >
              <RefreshCw className={`h-4 w-4 ${loadingSummaries ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        {!selectedPlantId ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">กรุณาเลือกโรงงานเพื่อดูข้อมูลกะ</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="shifts" className="space-y-4">
            <TabsList>
              <TabsTrigger value="shifts">สรุปกะ</TabsTrigger>
              <TabsTrigger value="groups">กลุ่มสิทธิ์</TabsTrigger>
              <TabsTrigger value="staff">จัดการพนักงาน</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="shifts" className="space-y-4">
              {loadingSummaries ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : shiftSummaries.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">ไม่พบข้อมูลกะสำหรับวันที่เลือก</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSummaries.map((summary) => (
                  <Card key={summary.shift_calendar_id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {summary.shift_name}
                            <StatusBadge status={summary.approval_status} />
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(summary.shift_date), 'EEEE d MMMM yyyy', { locale: th })}
                          </CardDescription>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>เครื่องจักร: {summary.machine_count || 0}</div>
                          <div>เวลาที่วางแผน: {summary.planned_time_minutes || 0} นาที</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* OEE Metrics */}
                      <OEEMetricsPanel
                        availability={summary.avg_availability}
                        performance={summary.avg_performance}
                        quality={summary.avg_quality}
                        oee={summary.avg_oee}
                        runTime={summary.total_run_time}
                        downtime={summary.total_downtime}
                        goodQty={summary.total_good_qty}
                        rejectQty={summary.total_reject_qty}
                      />

                      {/* Approval Controls */}
                      {isSupervisor && (
                        <ApprovalControls
                          shiftCalendarId={summary.shift_calendar_id}
                          status={summary.approval_status}
                          approvedBy={summary.approved_by}
                          approvedAt={summary.approved_at}
                          lockedBy={summary.locked_by}
                          lockedAt={summary.locked_at}
                          onApprove={() => approveMutation.mutate(summary.shift_calendar_id)}
                          onLock={() => lockMutation.mutate(summary.shift_calendar_id)}
                          onRecalc={() => recalcMutation.mutate(summary.shift_calendar_id)}
                          isApproving={approveMutation.isPending}
                          isLocking={lockMutation.isPending}
                          isRecalculating={recalcMutation.isPending}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="groups">
              <PermissionGroupManager />
            </TabsContent>

            <TabsContent value="staff">
              <StaffManager />
            </TabsContent>

            <TabsContent value="audit">
              <AuditLogViewer plantId={selectedPlantId} date={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'DRAFT') {
    return <Badge variant="secondary">Draft</Badge>;
  }
  if (status === 'APPROVED') {
    return (
      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Approved
      </Badge>
    );
  }
  if (status === 'LOCKED') {
    return (
      <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
        <Lock className="h-3 w-3 mr-1" />
        Locked
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}
