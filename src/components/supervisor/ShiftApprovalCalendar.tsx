import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, ClipboardCheck, ChevronLeft, ChevronRight, AlertCircle, Palmtree, Factory, HelpCircle, RefreshCw, BarChart, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Clock, Package, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [holidayNameInput, setHolidayNameInput] = useState('');

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
                const hasShifts = !!info;

                // If it's a past/present date with no recorded shift and not a pre-defined holiday,
                // we treat it as an actionable day (to let supervisor mark it as holiday or 0% work).
                const isActionableNoShift = !isFutureDate && !hasShifts && !isFuturePreDefinedHoliday && !holidayDateMap.has(day.date);

                const hasUnapproved = (hasShifts && (info?.hasUnapproved || false)) || isActionableNoShift;
                const allLocked = hasShifts && (info?.allLocked || false);
                const isHoliday = (hasShifts && (info?.isHoliday || false)) || isFuturePreDefinedHoliday || (!isFutureDate && holidayDateMap.has(day.date));
                const isNoActivity = hasShifts && (info?.isNoActivity && !info?.isPreDefinedHoliday || false);
                const isConfirmedHoliday = (hasShifts && (info?.isConfirmedHoliday && !info?.hasUnapproved && !isNoActivity || false)) || isFuturePreDefinedHoliday;
                const isConfirmedWorkingDay = hasShifts && (info?.isConfirmedWorkingDay && !info?.hasUnapproved && !isNoActivity || false);

                const showDot = hasShifts || isFuturePreDefinedHoliday || isActionableNoShift || isHoliday;
                const isSelected = selectedDate === day.date;
                const isToday = day.date === todayStr;
                const canSelect = hasShifts || isFuturePreDefinedHoliday || isActionableNoShift || isHoliday;

                return (
                  <button
                    key={day.date}
                    onClick={() => { setSelectedDate(isSelected ? null : day.date); setHolidayNameInput(''); }}
                    disabled={!canSelect}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg h-10 text-sm transition-all',
                      canSelect ? 'hover:bg-accent cursor-pointer' : 'text-muted-foreground/40 cursor-default',
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
          ) : selectedSummaries.length === 0 && !holidayDateMap.has(selectedDate) ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {format(new Date(selectedDate + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: th })}
                </h3>
              </div>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium mb-1">ไม่พบข้อมูลคาบการผลิตสำหรับวันนี้</p>
                  <p className="text-sm text-muted-foreground mb-6">ยังไม่มีการบันทึกเหตุการณ์กะทำงาน หรือการใช้เครื่องจักรในวันนี้</p>

                  {isSupervisor && (
                    <div className="w-full max-w-sm space-y-3 bg-muted/30 p-4 rounded-lg border">
                      <p className="text-sm font-medium text-left">คุณสามารถระบุให้วันนี้เป็นวันหยุดได้</p>
                      <Input
                        placeholder="ชื่อวันหยุด (เช่น วันหยุดประเพณี)"
                        value={holidayNameInput}
                        onChange={(e) => setHolidayNameInput(e.target.value)}
                        maxLength={100}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5"
                        onClick={async () => {
                          const trimmedName = holidayNameInput.trim();
                          if (!trimmedName) {
                            toast({ title: 'กรุณาระบุชื่อวันหยุด', variant: 'destructive' });
                            return;
                          }
                          if (company?.id && selectedDate) {
                            const { error: insertErr } = await supabase
                              .from('holidays')
                              .insert({
                                company_id: company.id,
                                plant_id: plantId,
                                holiday_date: selectedDate,
                                name: trimmedName,
                                is_recurring: false,
                              });
                            if (insertErr) {
                              toast({ title: 'ผิดพลาด', description: insertErr.message, variant: 'destructive' });
                              return;
                            }
                            setHolidayNameInput('');
                            toast({ title: 'สำเร็จ', description: `บันทึกเป็นวันหยุด "${trimmedName}" แล้ว` });
                            queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
                            queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
                            queryClient.invalidateQueries({ queryKey: ['holidays-calendar'] });
                          }
                        }}
                        disabled={!holidayNameInput.trim()}
                      >
                        <Palmtree className="h-4 w-4" />
                        ยืนยันเป็นวันหยุด
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : selectedSummaries.length === 0 && holidayDateMap.has(selectedDate) ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {format(new Date(selectedDate + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: th })}
                </h3>
                <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/20 border-0 font-medium">
                  <Palmtree className="h-3.5 w-3.5 mr-1" />
                  วันหยุดพิเศษ
                </Badge>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                <Palmtree className="h-5 w-5 text-sky-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    วันหยุดพิเศษ: {holidayDateMap.get(selectedDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">วันนี้ไม่ถูกนำมาคำนวณ OEE</p>
                </div>
              </div>
            </div>
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
                  {selectedSummaries.length > 0 && (
                    <OEESummaryModal summaries={selectedSummaries} dateStr={selectedDate} />
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
                    <p className="text-sm font-medium">
                      ยืนยันแล้ว: วันหยุด{holidayDateMap.has(selectedDate) ? ` — ${holidayDateMap.get(selectedDate)}` : ''}
                    </p>
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
                  <div className="ml-8 space-y-2">
                    <Input
                      placeholder="ชื่อวันหยุด (เช่น วันหยุดพิเศษ, หยุดซ่อมบำรุง)"
                      value={holidayNameInput}
                      onChange={(e) => setHolidayNameInput(e.target.value)}
                      maxLength={100}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={async () => {
                          const trimmedName = holidayNameInput.trim();
                          if (!trimmedName) {
                            toast({ title: 'กรุณาระบุชื่อวันหยุด', variant: 'destructive' });
                            return;
                          }
                          // Save holiday to database
                          if (company?.id && selectedDate) {
                            const { error: insertErr } = await supabase
                              .from('holidays')
                              .insert({
                                company_id: company.id,
                                plant_id: plantId,
                                holiday_date: selectedDate,
                                name: trimmedName,
                                is_recurring: false,
                              });
                            if (insertErr) {
                              toast({ title: 'ผิดพลาด', description: insertErr.message, variant: 'destructive' });
                              return;
                            }
                          }
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
                          setHolidayNameInput('');
                          toast({ title: 'สำเร็จ', description: `ยืนยันวันหยุด "${trimmedName}" และอนุมัติกะเรียบร้อยแล้ว` });
                          queryClient.invalidateQueries({ queryKey: ['shiftSummaries-calendar'] });
                          queryClient.invalidateQueries({ queryKey: ['shift-event-counts'] });
                          queryClient.invalidateQueries({ queryKey: ['holidays-calendar'] });
                        }}
                        disabled={recalcMutation.isPending || approveMutation.isPending || !holidayNameInput.trim()}
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
  return null;
}

// OEE Summary Modal Component
function OEESummaryModal({ summaries, dateStr }: { summaries: any[], dateStr: string }) {
  if (summaries.length === 0) return null;

  const validSummaries = summaries.filter(s => (s.machine_count || 0) > 0 || (s.total_run_time || 0) > 0);
  const totalShifts = validSummaries.length;

  if (totalShifts === 0) return null;

  let totalRunTime = 0;
  let totalDowntime = 0;
  let totalGoodQty = 0;
  let totalRejectQty = 0;
  let sumAvailability = 0;
  let sumPerformance = 0;
  let sumQuality = 0;
  let sumOee = 0;
  let totalPlannedTime = 0;
  let totalMachineCount = 0;

  validSummaries.forEach(s => {
    totalRunTime += s.total_run_time || 0;
    totalDowntime += s.total_downtime || 0;
    totalGoodQty += s.total_good_qty || 0;
    totalRejectQty += s.total_reject_qty || 0;
    sumAvailability += s.avg_availability || 0;
    sumPerformance += s.avg_performance || 0;
    sumQuality += s.avg_quality || 0;
    sumOee += s.avg_oee || 0;
    totalPlannedTime += s.planned_time_minutes || 0;
    totalMachineCount = Math.max(totalMachineCount, s.machine_count || 0);
  });

  const avgAvailability = sumAvailability / totalShifts;
  const avgPerformance = sumPerformance / totalShifts;
  const avgQuality = sumQuality / totalShifts;
  const avgOEE = sumOee / totalShifts;

  const totalProduced = totalGoodQty + totalRejectQty;
  const rejectRate = totalProduced > 0 ? (totalRejectQty / totalProduced) * 100 : 0;

  // World‑class OEE benchmarks: A ≥85%, P ≥95%, Q ≥99%, OEE ≥85%
  const OEE_TARGET = 85;
  const AVAIL_TARGET = 85;
  const PERF_TARGET = 95;
  const QUALITY_TARGET = 99;

  // Classify metrics
  const classify = (val: number, threshold: number) =>
    val >= threshold ? 'good' : val >= threshold * 0.75 ? 'warn' : 'bad';

  const oeeClass = classify(avgOEE, OEE_TARGET);
  const availClass = classify(avgAvailability, AVAIL_TARGET);
  const perfClass = classify(avgPerformance, PERF_TARGET);
  const qualClass = classify(avgQuality, QUALITY_TARGET);

  // OEE Loss breakdown (theoretical)
  // Availability Loss = planned - run
  // Performance Loss = (run - theoretical_ideal) can't compute without cycle time so estimate via 100% - performance
  // Quality Loss = reject / produced
  const availLossPct = 100 - avgAvailability;
  const perfLossPct = 100 - avgPerformance;
  const qualLossPct = 100 - avgQuality;

  // Find bottleneck
  const losses = [
    { name: 'Availability', val: availLossPct, pct: avgAvailability, target: AVAIL_TARGET, cls: availClass },
    { name: 'Performance', val: perfLossPct, pct: avgPerformance, target: PERF_TARGET, cls: perfClass },
    { name: 'Quality', val: qualLossPct, pct: avgQuality, target: QUALITY_TARGET, cls: qualClass },
  ].sort((a, b) => b.val - a.val);
  const bottleneck = losses[0];

  // Downtime ratio
  const totalPossibleTime = totalRunTime + totalDowntime;
  const downtimeRatio = totalPossibleTime > 0 ? (totalDowntime / totalPossibleTime) * 100 : 0;

  // Recommendations
  const recommendations: { icon: string; text: string; priority: 'high' | 'medium' | 'low' }[] = [];
  if (availClass !== 'good') {
    recommendations.push({
      icon: '🔧',
      text: `Availability ต่ำกว่าเป้า (${avgAvailability.toFixed(1)}% vs ${AVAIL_TARGET}%) — ตรวจสอบสาเหตุ Downtime ที่เกิดขึ้นบ่อย, วางแผน PM (Preventive Maintenance)`,
      priority: availClass === 'bad' ? 'high' : 'medium',
    });
  }
  if (perfClass !== 'good') {
    recommendations.push({
      icon: '⚡',
      text: `Performance ต่ำกว่าเป้า (${avgPerformance.toFixed(1)}% vs ${PERF_TARGET}%) — ตรวจสอบ Cycle Time จริงเทียบกับมาตรฐาน, ลด Minor Stops`,
      priority: perfClass === 'bad' ? 'high' : 'medium',
    });
  }
  if (qualClass !== 'good') {
    recommendations.push({
      icon: '✅',
      text: `Quality ต่ำกว่าเป้า (${avgQuality.toFixed(1)}% vs ${QUALITY_TARGET}%) — วิเคราะห์สาเหตุของเสีย, ตรวจสอบกระบวนการ QC`,
      priority: qualClass === 'bad' ? 'high' : 'medium',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      icon: '🏆',
      text: 'OEE อยู่ในระดับ World-Class — ดูแลมาตรฐานให้คงต่อเนื่อง',
      priority: 'low',
    });
  }

  const statusColor = oeeClass === 'good' ? 'text-green-500' : oeeClass === 'warn' ? 'text-yellow-500' : 'text-red-500';
  const metricColor = (cls: string) => cls === 'good' ? 'text-green-500' : cls === 'warn' ? 'text-yellow-500' : 'text-red-500';
  const barColor = (cls: string) => cls === 'good' ? 'bg-green-500' : cls === 'warn' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <BarChart className="h-3.5 w-3.5" />
          วิเคราะห์ OEE
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            รายงานวิเคราะห์ OEE — {format(new Date(dateStr + 'T00:00:00'), 'd MMMM yyyy', { locale: th })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* OEE Score Card */}
          <div className="rounded-xl border bg-muted/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">OEE รวมวันนี้</p>
                <p className={`text-5xl font-bold mt-1 ${statusColor}`}>{avgOEE.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">เป้าหมาย: {OEE_TARGET}%</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">{totalShifts} กะ • {totalMachineCount} เครื่องจักร</p>
                <p className="text-xs">Run: <span className="font-medium">{totalRunTime.toLocaleString()} นาที</span></p>
                <p className="text-xs">Downtime: <span className="font-medium text-yellow-500">{totalDowntime} นาที ({downtimeRatio.toFixed(1)}%)</span></p>
                <p className="text-xs">ผลิตดี: <span className="font-medium text-green-500">{totalGoodQty.toLocaleString()} ชิ้น</span></p>
                <p className="text-xs">ของเสีย: <span className="font-medium text-red-500">{totalRejectQty.toLocaleString()} ชิ้น ({rejectRate.toFixed(2)}%)</span></p>
              </div>
            </div>

            {/* OEE gauge bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span><span className="text-primary">{OEE_TARGET}% (เป้า)</span><span>100%</span>
              </div>
              <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(oeeClass)}`}
                  style={{ width: `${Math.min(avgOEE, 100)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/80"
                  style={{ left: `${OEE_TARGET}%` }}
                />
              </div>
            </div>
          </div>

          {/* Metric Breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              วิเคราะห์ตัวชี้วัดหลัก
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Availability', value: avgAvailability, target: AVAIL_TARGET, cls: availClass, lossName: 'เวลาหยุดเครื่อง', lossVal: availLossPct },
                { label: 'Performance', value: avgPerformance, target: PERF_TARGET, cls: perfClass, lossName: 'ผลิตช้ากว่ามาตรฐาน', lossVal: perfLossPct },
                { label: 'Quality', value: avgQuality, target: QUALITY_TARGET, cls: qualClass, lossName: 'ของเสีย', lossVal: qualLossPct },
              ].map(m => (
                <div key={m.label} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    {m.cls === 'good'
                      ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      : m.cls === 'warn'
                        ? <Minus className="h-3.5 w-3.5 text-yellow-500" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    }
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${metricColor(m.cls)}`}>{m.value.toFixed(1)}%</p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(m.cls)}`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">เป้า: {m.target}% • สูญเสีย: {m.lossVal.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{m.lossName}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottleneck Analysis */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              จุดคอขวดหลัก (Biggest Loss)
            </h4>
            <p className="text-sm">
              <span className="font-bold">{bottleneck.name}</span> มีการสูญเสียสูงสุด {bottleneck.val.toFixed(1)}%
              {' '}({bottleneck.pct.toFixed(1)}% vs เป้า {bottleneck.target}%)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {bottleneck.name === 'Availability'
                ? 'เครื่องจักรหยุดทำงาน/รอการซ่อม ส่งผลให้เสียเวลาการผลิตสูง — ควรวิเคราะห์ Downtime Log และ Pareto สาเหตุ'
                : bottleneck.name === 'Performance'
                  ? 'เครื่องจักรทำงานช้ากว่ามาตรฐาน หรือมีการหยุดสั้นๆ บ่อยครั้ง — ตรวจสอบ Cycle Time และ Minor Stops'
                  : 'ของเสียสูงกว่าที่ยอมรับได้ — ตรวจสอบมาตรฐานกระบวนการ, ปรับ SOP, เพิ่มความถี่ QC'
              }
            </p>
          </div>

          {/* Loss Waterfall */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              สัดส่วนการสูญเสีย OEE
            </h4>
            <div className="space-y-2">
              {losses.map((l, i) => (
                <div key={l.name} className="flex items-center gap-3">
                  <span className="text-sm w-24 text-right text-muted-foreground shrink-0">{l.name}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                    <div
                      className={`h-full ${barColor(l.cls)} opacity-80`}
                      style={{ width: `${Math.min(l.val * 2, 100)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                      สูญเสีย {l.val.toFixed(1)}%
                    </span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums w-14 text-right ${metricColor(l.cls)}`}>{l.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              ข้อเสนอแนะสำหรับผู้บริหาร
            </h4>
            <div className="space-y-2">
              {recommendations.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-sm flex gap-3 items-start ${r.priority === 'high' ? 'border-red-500/30 bg-red-500/5' :
                      r.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-green-500/30 bg-green-500/5'
                    }`}
                >
                  <span className="text-lg shrink-0">{r.icon}</span>
                  <p className="leading-relaxed text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shift breakdown */}
          {validSummaries.length > 1 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                รายละเอียดตามกะ
              </h4>
              <div className="space-y-2">
                {validSummaries.map((s, i) => (
                  <div key={s.shift_calendar_id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    <span className="font-medium">{s.shift_name}</span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                      <span>A: <span className={metricColor(classify(s.avg_availability || 0, AVAIL_TARGET))}>{(s.avg_availability || 0).toFixed(1)}%</span></span>
                      <span>P: <span className={metricColor(classify(s.avg_performance || 0, PERF_TARGET))}>{(s.avg_performance || 0).toFixed(1)}%</span></span>
                      <span>Q: <span className={metricColor(classify(s.avg_quality || 0, QUALITY_TARGET))}>{(s.avg_quality || 0).toFixed(1)}%</span></span>
                      <span className="font-bold">OEE: <span className={metricColor(classify(s.avg_oee || 0, OEE_TARGET))}>{(s.avg_oee || 0).toFixed(1)}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
