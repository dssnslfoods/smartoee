import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, ClipboardCheck, ChevronLeft, ChevronRight, AlertCircle, Palmtree, Factory, HelpCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OEEMetricsPanel } from './OEEMetricsPanel';
import { ApprovalControls } from './ApprovalControls';
import { ShiftActivityDetail } from './ShiftActivityDetail';
import oeeApi from '@/services/oeeApi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShiftApprovalCalendarProps {
  plantId: string;
  isSupervisor: boolean;
}

export function ShiftApprovalCalendar({ plantId, isSupervisor }: ShiftApprovalCalendarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch shift summaries for the entire visible month range
  const monthRange = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [currentMonth]);

  const { data: allSummaries = [], isLoading } = useQuery({
    queryKey: ['shiftSummaries-calendar', plantId, monthRange.startDate, monthRange.endDate],
    queryFn: () => oeeApi.getShiftSummaries(plantId, monthRange.startDate, monthRange.endDate),
    enabled: !!plantId,
  });

  // Fetch pre-defined holidays for this month
  const { data: preDefinedHolidays = [] } = useQuery({
    queryKey: ['holidays-calendar', company?.id, plantId, monthRange.startDate, monthRange.endDate],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('holidays')
        .select('holiday_date, name, is_recurring, plant_id')
        .eq('company_id', company.id)
        .or(`plant_id.is.null,plant_id.eq.${plantId}`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!company?.id && !!plantId,
  });

  // Build a set of holiday dates (including recurring matched by month/day)
  const holidayDateMap = useMemo(() => {
    const map = new Map<string, string>(); // date -> name
    for (const h of preDefinedHolidays) {
      if (h.is_recurring) {
        // Match same month/day across the current month's year
        const mm = h.holiday_date.slice(5); // MM-DD
        const yearStr = format(currentMonth, 'yyyy');
        map.set(`${yearStr}-${mm}`, h.name);
      } else {
        map.set(h.holiday_date, h.name);
      }
    }
    return map;
  }, [preDefinedHolidays, currentMonth]);

  // Fetch event counts per shift_calendar_id for holiday detection
  const shiftCalendarIds = useMemo(() => allSummaries.map(s => s.shift_calendar_id).filter(Boolean) as string[], [allSummaries]);

  const { data: eventCountMap = new Map<string, number>() } = useQuery({
    queryKey: ['shift-event-counts', shiftCalendarIds],
    queryFn: async () => {
      if (!shiftCalendarIds.length) return new Map<string, number>();
      const { data } = await supabase
        .from('production_events')
        .select('shift_calendar_id')
        .in('shift_calendar_id', shiftCalendarIds);
      const map = new Map<string, number>();
      for (const row of (data || [])) {
        map.set(row.shift_calendar_id!, (map.get(row.shift_calendar_id!) || 0) + 1);
      }
      return map;
    },
    enabled: shiftCalendarIds.length > 0,
    staleTime: 30_000,
  });

  // Group summaries by date and compute status per date
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, { 
      summaries: typeof allSummaries; 
      hasUnapproved: boolean; 
      allLocked: boolean; 
      isHoliday: boolean; 
      isPreDefinedHoliday: boolean; 
      holidayName?: string; 
      isNoActivity: boolean;
      isConfirmedHoliday: boolean;
      isConfirmedWorkingDay: boolean;
    }>();
    for (const s of allSummaries) {
      if (!s.shift_date) continue;
      const existing = map.get(s.shift_date) || { 
        summaries: [], hasUnapproved: false, allLocked: true, 
        isHoliday: false, isPreDefinedHoliday: false, isNoActivity: true,
        isConfirmedHoliday: false, isConfirmedWorkingDay: false,
      };
      existing.summaries.push(s);
      if (!s.approval_status || s.approval_status === 'DRAFT') {
        existing.hasUnapproved = true;
        existing.isConfirmedHoliday = false;
        existing.isConfirmedWorkingDay = false;
      }
      if (s.approval_status !== 'LOCKED') {
        existing.allLocked = false;
      }
      // Check if this shift has real production activity (raw events or actual run/good output)
      const hasRealActivity = (s.total_run_time != null && Number(s.total_run_time) > 0)
        || (s.total_good_qty != null && Number(s.total_good_qty) > 0)
        || (s.total_reject_qty != null && Number(s.total_reject_qty) > 0);
      const hasRawEvents = (eventCountMap.get(s.shift_calendar_id!) || 0) > 0;
      if (hasRealActivity || hasRawEvents) {
        existing.isHoliday = false;
        existing.isNoActivity = false;
        existing.isConfirmedHoliday = false;
        existing.isConfirmedWorkingDay = false;
      } else if (s.approval_status === 'APPROVED' || s.approval_status === 'LOCKED') {
        // Approved with no real activity: check if OEE=0% (working day) or no OEE (holiday)
        existing.isNoActivity = false; // No longer "unconfirmed no-activity"
        // Distinguish: forced working day has downtime (= planned_time * machines), holiday has 0
        const hasDowntimeSnapshot = (s.total_downtime != null && Number(s.total_downtime) > 0);
        if (hasDowntimeSnapshot) {
          // Has downtime = confirmed as working day (OEE forced to 0%)
          existing.isConfirmedWorkingDay = true;
        } else {
          // No downtime = confirmed as holiday (no OEE snapshots)
          existing.isConfirmedHoliday = true;
          existing.isHoliday = true;
        }
      }
      // Check pre-defined holidays (overrides activity check)
      const predefined = holidayDateMap.get(s.shift_date);
      if (predefined) {
        existing.isHoliday = true;
        existing.isPreDefinedHoliday = true;
        existing.holidayName = predefined;
        existing.isConfirmedHoliday = true;
        existing.isConfirmedWorkingDay = false;
      }
      map.set(s.shift_date, existing);
    }
    return map;
  }, [allSummaries, holidayDateMap, eventCountMap]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Summaries for the selected date
  const selectedSummaries = useMemo(() => {
    if (!selectedDate) return [];
    return dateStatusMap.get(selectedDate)?.summaries || [];
  }, [selectedDate, dateStatusMap]);

  // Count of unapproved dates
  const unapprovedCount = useMemo(() => {
    let count = 0;
    dateStatusMap.forEach((v, dateStr) => { if (v.hasUnapproved && dateStr <= todayStr) count++; });
    return count;
  }, [dateStatusMap, todayStr]);

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await oeeApi.approveShift(id);
      if (!result.success) throw new Error(result.message || 'Failed');
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'อนุมัติกะเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
    },
    onError: (e: Error) => toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const lockMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await oeeApi.lockShift(id);
      if (!result.success) throw new Error(result.message || 'Failed');
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ล็อคกะเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
    },
    onError: (e: Error) => toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const unlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await oeeApi.unlockShift(id);
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'ปลดล็อคกะเรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
    },
    onError: (e: Error) => toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const recalcMutation = useMutation({
    mutationFn: async ({ id, forceWorkingDay }: { id: string; forceWorkingDay?: boolean }) => {
      const result = await oeeApi.recalcOeeForShift(id, forceWorkingDay);
      if (!result.success) throw new Error(result.message || 'Failed');
      return result;
    },
    onSuccess: () => {
      toast({ title: 'สำเร็จ', description: 'คำนวณ OEE ใหม่เรียบร้อยแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
    },
    onError: (e: Error) => toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDay = start.getDay(); // 0=Sun
    const totalDays = end.getDate();

    const days: Array<{ date: string; day: number } | null> = [];
    // Pad leading empty days
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d), 'yyyy-MM-dd');
      days.push({ date: dateStr, day: d });
    }
    return days;
  }, [currentMonth]);

  // todayStr moved above unapprovedCount

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {unapprovedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">มี {unapprovedCount} วันที่ยังไม่ได้อนุมัติกะ</p>
            <p className="text-xs text-muted-foreground">กดเลือกวันที่ต้องการเพื่อตรวจสอบและอนุมัติ</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">
                {format(currentMonth, 'MMMM yyyy', { locale: th })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
                    queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
                    queryClient.invalidateQueries({ queryKey: ['holidays-calendar'] });
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const info = dateStatusMap.get(day.date);
                const isFutureDate = day.date > todayStr;
                const isFuturePreDefinedHoliday = isFutureDate && holidayDateMap.has(day.date);
                const hasShifts = !!info && !isFutureDate;
                const hasUnapproved = hasShifts && (info?.hasUnapproved || false);
                const allLocked = hasShifts && (info?.allLocked || false);
                const isHoliday = (hasShifts && (info?.isHoliday || false)) || isFuturePreDefinedHoliday;
                const isNoActivity = hasShifts && (info?.isNoActivity && !info?.isPreDefinedHoliday || false);
                const isConfirmedHoliday = (hasShifts && (info?.isConfirmedHoliday && !info?.hasUnapproved && !isNoActivity || false)) || isFuturePreDefinedHoliday;
                const isConfirmedWorkingDay = hasShifts && (info?.isConfirmedWorkingDay && !info?.hasUnapproved && !isNoActivity || false);
                const showDot = hasShifts || isFuturePreDefinedHoliday;
                const isSelected = selectedDate === day.date;
                const isToday = day.date === todayStr;

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(isSelected ? null : day.date)}
                    disabled={!hasShifts && !isFuturePreDefinedHoliday}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg h-10 text-sm transition-all',
                      (hasShifts || isFuturePreDefinedHoliday) ? 'hover:bg-accent cursor-pointer' : 'text-muted-foreground/40 cursor-default',
                      isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      isToday && !isSelected && 'ring-1 ring-primary/50',
                      (isHoliday || isConfirmedHoliday) && !isSelected && 'bg-sky-500/10 text-muted-foreground',
                      isNoActivity && !isSelected && 'bg-violet-500/10',
                      isConfirmedWorkingDay && !isSelected && 'bg-rose-500/10',
                    )}
                  >
                    <span className="font-medium">{day.day}</span>
                    {/* Status dots */}
                    {showDot && (
                      <div className="absolute bottom-0.5 flex gap-0.5">
                        {(isHoliday || isConfirmedHoliday) ? (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-sky-400'
                          )} />
                        ) : isNoActivity ? (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-violet-400'
                          )} />
                        ) : isConfirmedWorkingDay ? (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-rose-400'
                          )} />
                        ) : hasUnapproved ? (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-amber-500'
                          )} />
                        ) : allLocked ? (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground/50'
                          )} />
                        ) : (
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-emerald-500'
                          )} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                ยังไม่อนุมัติ
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                อนุมัติแล้ว
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                ล็อคแล้ว
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                เลือกประเภทวัน
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                วันทำงาน (0%)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                วันหยุด
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected date detail */}
        <div className="space-y-4">
          {!selectedDate ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">เลือกวันที่จากปฏิทิน</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  กดวันที่มีจุดสีเหลือง (●) เพื่อตรวจสอบและอนุมัติกะ
                </p>
              </CardContent>
            </Card>
          ) : selectedSummaries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">ไม่พบข้อมูลกะสำหรับวันนี้</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {format(new Date(selectedDate + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: th })}
                </h3>
                <div className="flex items-center gap-2">
                  {dateStatusMap.get(selectedDate)?.isHoliday && (
                    <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/20 border-0 font-medium">
                      <Palmtree className="h-3.5 w-3.5 mr-1" />
                      วันหยุดพิเศษ
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {selectedSummaries.length} กะ
                  </Badge>
                </div>
              </div>

              {dateStatusMap.get(selectedDate)?.isPreDefinedHoliday && (
                <div className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                  <Palmtree className="h-5 w-5 text-sky-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      วันหยุดพิเศษ: {dateStatusMap.get(selectedDate)?.holidayName}
                    </p>
                    <p className="text-xs text-muted-foreground">วันนี้ไม่ถูกนำมาคำนวณ OEE</p>
                  </div>
                </div>
              )}

              {dateStatusMap.get(selectedDate)?.isConfirmedHoliday && !dateStatusMap.get(selectedDate)?.isPreDefinedHoliday && (
                <div className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                  <Palmtree className="h-5 w-5 text-sky-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">ยืนยันแล้ว: วันหยุด</p>
                    <p className="text-xs text-muted-foreground">วันนี้ไม่ถูกนำมาคำนวณ OEE</p>
                  </div>
                </div>
              )}

              {dateStatusMap.get(selectedDate)?.isNoActivity && !dateStatusMap.get(selectedDate)?.isPreDefinedHoliday && isSupervisor && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">ไม่มีกิจกรรมการผลิตในวันนี้</p>
                      <p className="text-xs text-muted-foreground">กรุณายืนยันว่าวันนี้เป็นวันหยุดหรือวันทำงาน ระบบจะคำนวณ OEE และอนุมัติกะให้อัตโนมัติ</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-8">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={async () => {
                        // Confirm as holiday — recalc (skip OEE) then auto-approve all shifts
                        for (const s of selectedSummaries) {
                          try {
                            await oeeApi.recalcOeeForShift(s.shift_calendar_id);
                            await oeeApi.approveShift(s.shift_calendar_id);
                          } catch (e: any) {
                            toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
                            return;
                          }
                        }
                        toast({ title: 'สำเร็จ', description: 'ยืนยันวันหยุดและอนุมัติกะเรียบร้อยแล้ว' });
                        queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
                        queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
                      }}
                      disabled={recalcMutation.isPending || approveMutation.isPending}
                    >
                      <Palmtree className="h-3.5 w-3.5" />
                      ยืนยันวันหยุด
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        // Confirm as working day — recalc with force + auto-approve all shifts
                        for (const s of selectedSummaries) {
                          try {
                            await oeeApi.recalcOeeForShift(s.shift_calendar_id, true);
                            await oeeApi.approveShift(s.shift_calendar_id);
                          } catch (e: any) {
                            toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
                            return;
                          }
                        }
                        toast({ title: 'สำเร็จ', description: 'ยืนยันวันทำงานและอนุมัติกะเรียบร้อยแล้ว (OEE = 0%)' });
                        queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
                        queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
                      }}
                      disabled={recalcMutation.isPending || approveMutation.isPending}
                    >
                      <Factory className="h-3.5 w-3.5" />
                      ยืนยันวันทำงาน (OEE = 0%)
                    </Button>
                  </div>
                </div>
              )}

              {selectedSummaries.map((summary) => (
                <Card key={summary.shift_calendar_id} className="overflow-hidden">
                  <CardHeader className="pb-4 bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                            {summary.plant_name}
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
                        onUnlock={() => unlockMutation.mutate(summary.shift_calendar_id)}
                        onRecalc={() => recalcMutation.mutate({ id: summary.shift_calendar_id })}
                        isApproving={approveMutation.isPending}
                        isLocking={lockMutation.isPending}
                        isUnlocking={unlockMutation.isPending}
                        isRecalculating={recalcMutation.isPending}
                      />
                    )}

                    <ShiftActivityDetail
                      shiftCalendarId={summary.shift_calendar_id}
                      isLocked={summary.approval_status === 'LOCKED'}
                      isSupervisor={isSupervisor}
                    />
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
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
