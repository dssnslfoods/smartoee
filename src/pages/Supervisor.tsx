import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, RefreshCw, CalendarIcon, X, ClipboardCheck } from 'lucide-react';
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
import { PageHeader } from '@/components/ui/PageHeader';
import { ShiftCardSkeleton } from '@/components/ui/skeletons';
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return { startDate: dateStr, endDate: dateStr };
    } else {
      const startDate = format(subDays(today, 2), 'yyyy-MM-dd');
      const endDate = format(addDays(today, 2), 'yyyy-MM-dd');
      return { startDate, endDate };
    }
  }, [selectedDate]);

  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => oeeApi.getPlants(),
  });

  const { data: shiftSummaries = [], isLoading: loadingSummaries, refetch: refetchSummaries } = useQuery({
    queryKey: ['shiftSummaries', selectedPlantId, dateRange.startDate, dateRange.endDate],
    queryFn: () => oeeApi.getShiftSummaries(selectedPlantId, dateRange.startDate, dateRange.endDate),
    enabled: !!selectedPlantId,
  });

  const filteredSummaries = useMemo(() => {
    if (selectedDate || shiftSummaries.length <= 6) {
      return shiftSummaries;
    }
    
    const now = new Date();
    const nowStr = format(now, 'yyyy-MM-dd');
    
    let currentIdx = shiftSummaries.findIndex(s => s.shift_date === nowStr);
    if (currentIdx === -1) {
      currentIdx = shiftSummaries.findIndex(s => s.shift_date && s.shift_date < nowStr);
      if (currentIdx === -1) currentIdx = 0;
    }
    
    const start = Math.max(0, currentIdx - 3);
    const end = Math.min(shiftSummaries.length, currentIdx + 4);
    
    return shiftSummaries.slice(start, end);
  }, [shiftSummaries, selectedDate]);

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

  if (!isSupervisor) {
    return (
      <AppLayout>
        <div className="page-container">
          <Card className="max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
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
      <div className="page-container space-y-6">
        {/* Header */}
        <PageHeader 
          title="Supervisor Dashboard" 
          description="จัดการและปิดกะ"
          icon={ClipboardCheck}
        >
          <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
            <SelectTrigger className="w-[160px] sm:w-[180px] bg-background">
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

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[160px] sm:w-[200px] justify-start text-left font-normal bg-background",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, 'd MMM yyyy', { locale: th })
                ) : (
                  <span className="truncate">กะล่าสุด</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          {selectedDate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(undefined)}
              className="h-9 w-9"
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
            className="h-9 w-9 bg-background"
          >
            <RefreshCw className={cn("h-4 w-4", loadingSummaries && "animate-spin")} />
          </Button>
        </PageHeader>

        {/* Main Content */}
        {!selectedPlantId ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">เลือกโรงงาน</h3>
              <p className="text-muted-foreground max-w-sm">
                กรุณาเลือกโรงงานเพื่อดูข้อมูลกะและอนุมัติการผลิต
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="shifts" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="shifts" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                สรุปกะ
              </TabsTrigger>
              <TabsTrigger value="groups" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                กลุ่มสิทธิ์
              </TabsTrigger>
              <TabsTrigger value="staff" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                จัดการพนักงาน
              </TabsTrigger>
              <TabsTrigger value="audit" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Audit Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shifts" className="space-y-4 mt-0">
              {loadingSummaries ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <ShiftCardSkeleton key={i} />
                  ))}
                </div>
              ) : shiftSummaries.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-muted-foreground">ไม่พบข้อมูลกะสำหรับวันที่เลือก</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSummaries.map((summary) => (
                  <Card key={summary.shift_calendar_id} className="overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ClipboardCheck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                              {summary.shift_name}
                              <StatusBadge status={summary.approval_status} />
                            </CardTitle>
                            <CardDescription className="mt-0.5">
                              {format(new Date(summary.shift_date), 'EEEE d MMMM yyyy', { locale: th })}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-4 sm:gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">เครื่องจักร</p>
                            <p className="font-semibold">{summary.machine_count || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">เวลาวางแผน</p>
                            <p className="font-semibold">{summary.planned_time_minutes || 0} นาที</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
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

            <TabsContent value="groups" className="mt-0">
              <PermissionGroupManager />
            </TabsContent>

            <TabsContent value="staff" className="mt-0">
              <StaffManager />
            </TabsContent>

            <TabsContent value="audit" className="mt-0">
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
    return (
      <Badge variant="secondary" className="font-medium">
        Draft
      </Badge>
    );
  }
  if (status === 'APPROVED') {
    return (
      <Badge className="bg-status-running/15 text-status-running hover:bg-status-running/20 border-0 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        Approved
      </Badge>
    );
  }
  if (status === 'LOCKED') {
    return (
      <Badge className="bg-status-idle/15 text-status-idle hover:bg-status-idle/20 border-0 font-medium">
        <Lock className="h-3.5 w-3.5 mr-1" />
        Locked
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}
