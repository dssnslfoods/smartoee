import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { OEEMetricsPanel } from '@/components/supervisor/OEEMetricsPanel';
import { ApprovalControls } from '@/components/supervisor/ApprovalControls';
import { AuditLogViewer } from '@/components/supervisor/AuditLogViewer';
import oeeApi from '@/services/oeeApi';

export default function Supervisor() {
  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Fetch plants
  const { data: plants = [] } = useQuery({
    queryKey: ['plants'],
    queryFn: () => oeeApi.getPlants(),
  });

  // Fetch shift summaries for selected plant and date
  const { data: shiftSummaries = [], isLoading: loadingSummaries, refetch: refetchSummaries } = useQuery({
    queryKey: ['shiftSummaries', selectedPlantId, selectedDate],
    queryFn: () => oeeApi.getShiftSummaries(selectedPlantId, selectedDate),
    enabled: !!selectedPlantId,
  });

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/shopfloor">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Supervisor Dashboard</h1>
              <p className="text-muted-foreground">จัดการและปิดกะ</p>
            </div>
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

            {/* Date Selector */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            />

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
                shiftSummaries.map((summary) => (
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

            <TabsContent value="audit">
              <AuditLogViewer plantId={selectedPlantId} date={selectedDate} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
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
