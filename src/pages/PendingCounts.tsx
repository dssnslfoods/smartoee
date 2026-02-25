import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { useAuth } from '@/hooks/useAuth';
import { getDefectReasons, addCountsBackdate } from '@/services';
import { cn } from '@/lib/utils';
import { ClipboardList, Play, Package, Clock, ChevronLeft, CheckCircle2, Calendar, Factory, User, Layers, SplitSquareHorizontal, Equal, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { toast } from 'sonner';

interface PendingRun {
  id: string;
  machine_id: string;
  machine_name: string;
  machine_code: string;
  event_type: string;
  start_ts: string;
  end_ts: string;
  product_name: string | null;
  product_code: string | null;
  shift_date: string;
  plant_name: string | null;
  staff_name: string | null;
  shift_calendar_id: string | null;
}

interface PendingGroup {
  key: string;
  machine_id: string;
  machine_name: string;
  machine_code: string;
  product_name: string | null;
  product_code: string | null;
  plant_name: string | null;
  events: PendingRun[];
  totalMinutes: number;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

function groupEventsByMachineSku(runs: PendingRun[]): PendingGroup[] {
  const map = new Map<string, PendingGroup>();
  for (const run of runs) {
    const key = `${run.machine_id}::${run.product_code || 'NO_SKU'}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        machine_id: run.machine_id,
        machine_name: run.machine_name,
        machine_code: run.machine_code,
        product_name: run.product_name,
        product_code: run.product_code,
        plant_name: run.plant_name,
        events: [],
        totalMinutes: 0,
      });
    }
    const group = map.get(key)!;
    group.events.push(run);
    const ms = new Date(run.end_ts).getTime() - new Date(run.start_ts).getTime();
    group.totalMinutes += ms / 60000;
  }
  return [...map.values()].sort((a, b) => b.events.length - a.events.length);
}

function computeSplit(
  events: PendingRun[],
  goodQty: number,
  rejectQty: number,
  mode: 'proportional' | 'equal'
): { eventId: string; startTs: string; endTs: string; good: number; reject: number; minutes: number }[] {
  const count = events.length;
  const totalMs = events.reduce((s, e) => s + (new Date(e.end_ts).getTime() - new Date(e.start_ts).getTime()), 0);
  let remainGood = goodQty;
  let remainReject = rejectQty;

  return events.map((ev, i) => {
    const isLast = i === count - 1;
    const evMs = new Date(ev.end_ts).getTime() - new Date(ev.start_ts).getTime();
    let good: number, reject: number;

    if (mode === 'equal') {
      good = isLast ? remainGood : Math.round(goodQty / count);
      reject = isLast ? remainReject : Math.round(rejectQty / count);
    } else {
      const ratio = totalMs > 0 ? evMs / totalMs : 1 / count;
      good = isLast ? remainGood : Math.round(goodQty * ratio);
      reject = isLast ? remainReject : Math.round(rejectQty * ratio);
    }
    remainGood -= good;
    remainReject -= reject;

    return { eventId: ev.id, startTs: ev.start_ts, endTs: ev.end_ts, good, reject, minutes: evMs / 60000 };
  });
}

function SplitPreview({
  events,
  goodQty,
  rejectQty,
  splitMode,
}: {
  events: PendingRun[];
  goodQty: number;
  rejectQty: number;
  splitMode: 'proportional' | 'equal';
}) {
  const splits = computeSplit(events, goodQty, rejectQty, splitMode);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Eye className="h-3.5 w-3.5" />
        Preview การแบ่งจำนวน ({splitMode === 'equal' ? 'เท่ากัน' : 'ตามสัดส่วนเวลา'})
      </div>
      <div className="space-y-1.5">
        {splits.map((s, i) => (
          <div key={s.eventId} className="flex items-center justify-between text-xs rounded-md bg-card/50 px-2.5 py-1.5 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">#{i + 1}</span>
              <span className="font-mono">
                {format(new Date(s.startTs), 'HH:mm')} - {format(new Date(s.endTs), 'HH:mm')}
              </span>
              <span className="text-[10px] opacity-60">({formatDuration(s.minutes)})</span>
            </div>
            <div className="flex items-center gap-3 font-semibold tabular-nums">
              <span className="text-green-500">{s.good.toLocaleString()}</span>
              {s.reject > 0 && <span className="text-red-500">{s.reject.toLocaleString()}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
        <span>รวม {events.length} เหตุการณ์</span>
        <span className="tabular-nums font-medium">
          ดี: {goodQty.toLocaleString()} {rejectQty > 0 && `• เสีย: ${rejectQty.toLocaleString()}`}
        </span>
      </div>
    </div>
  );
}

export default function PendingCounts() {
  const queryClient = useQueryClient();
  const { company, isAdmin, hasRole } = useAuth();
  const companyId = company?.id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filterMachineId = searchParams.get('machine_id');

  // View modes: 'list' (default), 'group-select' (selecting events in a group), 'form' (entering counts)
  const [selectedEvent, setSelectedEvent] = useState<PendingRun | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PendingGroup | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'group-select' | 'form'>('list');
  const [splitMode, setSplitMode] = useState<'proportional' | 'equal'>('proportional');
  const [autoSelected, setAutoSelected] = useState(false);
  const [formGoodQty, setFormGoodQty] = useState(0);
  const [formRejectQty, setFormRejectQty] = useState(0);

  // Fetch all pending RUN events
  const { data: pendingRuns = [], isLoading } = useQuery({
    queryKey: ['pending-counts-all', companyId],
    queryFn: async () => {
      let machineQuery = supabase
        .from('machines')
        .select('id, name, code, line_id, is_active, lines!inner(name, plant_id, plants!inner(name))')
        .eq('is_active', true)
        .order('name');

      if (companyId) {
        machineQuery = machineQuery.eq('company_id', companyId);
      }

      const { data: machines, error: mErr } = await machineQuery;
      if (mErr) throw mErr;
      if (!machines?.length) return [];

      const machineIds = machines.map(m => m.id);
      const machineMap = new Map(machines.map(m => [m.id, m]));

      const { data: runEvents, error: eErr } = await supabase
        .from('production_events')
        .select('id, machine_id, event_type, start_ts, end_ts, product_id, shift_calendar_id, created_by, products(name, code), shift_calendar!inner(shift_date)')
        .in('machine_id', machineIds)
        .eq('event_type', 'RUN')
        .not('end_ts', 'is', null)
        .order('start_ts', { ascending: false });

      if (eErr) throw eErr;
      if (!runEvents?.length) return [];

      const creatorIds = [...new Set(runEvents.map(e => e.created_by).filter(Boolean))];
      const { data: profiles } = creatorIds.length > 0
        ? await supabase.from('user_profiles').select('user_id, full_name').in('user_id', creatorIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      const eventIds = runEvents.map(e => e.id);
      const { data: countsData } = await supabase
        .from('production_counts')
        .select('production_event_id')
        .in('production_event_id', eventIds)
        .not('production_event_id', 'is', null);

      const hasCountsSet = new Set<string>(
        (countsData || []).map((c: any) => c.production_event_id).filter(Boolean)
      );

      const results: PendingRun[] = [];
      for (const ev of runEvents) {
        if (hasCountsSet.has(ev.id)) continue;

        const machine = machineMap.get(ev.machine_id);
        const product = ev.products as { name: string; code: string } | null;
        const sc = ev.shift_calendar as { shift_date: string } | null;
        const lineData = machine?.lines as any;
        const plantName = lineData?.plants?.name || null;

        results.push({
          id: ev.id,
          machine_id: ev.machine_id,
          machine_name: machine?.name || '',
          machine_code: machine?.code || '',
          event_type: ev.event_type,
          start_ts: ev.start_ts,
          end_ts: ev.end_ts!,
          product_name: product?.name || null,
          product_code: product?.code || null,
          shift_date: sc?.shift_date || format(new Date(ev.start_ts), 'yyyy-MM-dd'),
          plant_name: plantName,
          staff_name: profileMap.get(ev.created_by) || null,
          shift_calendar_id: ev.shift_calendar_id,
        });
      }

      return results;
    },
    refetchInterval: 15000,
  });

  // Auto-select first matching event when navigated with machine_id query param
  useEffect(() => {
    if (filterMachineId && pendingRuns.length > 0 && !autoSelected) {
      const match = pendingRuns.find(r => r.machine_id === filterMachineId);
      if (match) {
        setSelectedEvent(match);
        setViewMode('form');
        setAutoSelected(true);
      }
    }
  }, [filterMachineId, pendingRuns, autoSelected]);

  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons', companyId],
    queryFn: () => getDefectReasons(companyId),
  });

  // Single event submit
  const addCountsMutation = useMutation({
    mutationFn: async (data: { goodQty: number; rejectQty: number; defectReasonId?: string; notes?: string }) => {
      if (!selectedEvent) throw new Error('No event selected');
      return addCountsBackdate(
        selectedEvent.machine_id,
        data.goodQty,
        data.rejectQty,
        data.defectReasonId,
        data.notes,
        selectedEvent.shift_calendar_id || undefined,
        selectedEvent.end_ts,
        selectedEvent.id
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('บันทึกจำนวนผลิตสำเร็จ');
        resetView();
        invalidateAll();
      } else {
        toast.error(data.message || 'ไม่สามารถบันทึกได้');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    },
  });

  // Bulk submit for grouped events
  const bulkCountsMutation = useMutation({
    mutationFn: async (data: { goodQty: number; rejectQty: number; defectReasonId?: string; notes?: string }) => {
      if (!selectedGroup || selectedEventIds.size === 0) throw new Error('No events selected');

      const eventsToRecord = selectedGroup.events.filter(e => selectedEventIds.has(e.id));
      const count = eventsToRecord.length;

      const totalMs = eventsToRecord.reduce((sum, e) => sum + (new Date(e.end_ts).getTime() - new Date(e.start_ts).getTime()), 0);

      const results: any[] = [];
      let remainGood = data.goodQty;
      let remainReject = data.rejectQty;

      for (let i = 0; i < eventsToRecord.length; i++) {
        const ev = eventsToRecord[i];
        const isLast = i === eventsToRecord.length - 1;

        let goodForThis: number;
        let rejectForThis: number;

        if (splitMode === 'equal') {
          goodForThis = isLast ? remainGood : Math.round(data.goodQty / count);
          rejectForThis = isLast ? remainReject : Math.round(data.rejectQty / count);
        } else {
          const evMs = new Date(ev.end_ts).getTime() - new Date(ev.start_ts).getTime();
          const ratio = totalMs > 0 ? evMs / totalMs : 1 / count;
          goodForThis = isLast ? remainGood : Math.round(data.goodQty * ratio);
          rejectForThis = isLast ? remainReject : Math.round(data.rejectQty * ratio);
        }
        remainGood -= goodForThis;
        remainReject -= rejectForThis;

        const result = await addCountsBackdate(
          ev.machine_id,
          goodForThis,
          rejectForThis,
          data.defectReasonId,
          data.notes,
          ev.shift_calendar_id || undefined,
          ev.end_ts,
          ev.id
        );
        results.push(result);
      }

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        throw new Error(`บันทึกสำเร็จ ${results.length - failures.length}/${results.length} รายการ`);
      }
      return { success: true, count: results.length };
    },
    onSuccess: (data) => {
      toast.success(`บันทึกจำนวนผลิตสำเร็จ ${data.count} เหตุการณ์`);
      resetView();
      invalidateAll();
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
      invalidateAll();
    },
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['pending-counts-all'] });
    queryClient.invalidateQueries({ queryKey: ['pending-counts-badge'] });
    queryClient.invalidateQueries({ queryKey: ['productionCounts'] });
    queryClient.invalidateQueries({ queryKey: ['monitor-machines'] });
  }

  function resetView() {
    setSelectedEvent(null);
    setSelectedGroup(null);
    setSelectedEventIds(new Set());
    setViewMode('list');
  }

  // Group by date, then within each date group by machine+SKU
  const groupedByDate = useMemo(() => {
    const map = new Map<string, PendingRun[]>();
    for (const run of pendingRuns) {
      const date = run.shift_date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(run);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, runs]) => ({
        date,
        runs,
        groups: groupEventsByMachineSku(runs),
      }));
  }, [pendingRuns]);

  const totalPending = pendingRuns.length;

  function handleGroupClick(group: PendingGroup) {
    if (group.events.length === 1) {
      // Single event — go straight to form
      setSelectedEvent(group.events[0]);
      setViewMode('form');
    } else {
      // Multiple events — show selection
      setSelectedGroup(group);
      setSelectedEventIds(new Set(group.events.map(e => e.id))); // Select all by default
      setViewMode('group-select');
    }
  }

  function handleToggleEvent(eventId: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  function handleToggleAll() {
    if (!selectedGroup) return;
    if (selectedEventIds.size === selectedGroup.events.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(selectedGroup.events.map(e => e.id)));
    }
  }

  function handleProceedToForm() {
    if (selectedEventIds.size === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 เหตุการณ์');
      return;
    }
    setViewMode('form');
  }

  // Render: form view (single or bulk)
  if (viewMode === 'form' && (selectedEvent || selectedGroup)) {
    const isBulk = !!selectedGroup;
    const eventsInScope = isBulk
      ? selectedGroup!.events.filter(e => selectedEventIds.has(e.id))
      : [selectedEvent!];
    const totalMin = eventsInScope.reduce((sum, e) => sum + (new Date(e.end_ts).getTime() - new Date(e.start_ts).getTime()) / 60000, 0);

    return (
      <AppLayout>
        <div className="page-container space-y-5">
          <PageHeader title="รอบันทึกจำนวนผลิต" description="เหตุการณ์ RUN ที่จบแล้วแต่ยังไม่ได้บันทึกจำนวนผลิต" icon={ClipboardList} />

          <Button variant="ghost" size="sm" onClick={() => {
            if (isBulk) setViewMode('group-select');
            else resetView();
          }} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Button>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-running/10">
                  {isBulk ? <Layers className="h-5 w-5 text-status-running" /> : <Play className="h-5 w-5 text-status-running" />}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {eventsInScope[0].machine_name}{' '}
                    <span className="text-xs font-mono text-muted-foreground">({eventsInScope[0].machine_code})</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {eventsInScope[0].product_name && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {eventsInScope[0].product_name}
                        {eventsInScope[0].product_code && <span className="font-mono">({eventsInScope[0].product_code})</span>}
                      </span>
                    )}
                    {isBulk ? (
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {eventsInScope.length} เหตุการณ์ • รวม {formatDuration(totalMin)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(eventsInScope[0].start_ts), 'HH:mm')} - {format(new Date(eventsInScope[0].end_ts), 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Show event list summary for bulk */}
              {isBulk && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {eventsInScope.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">
                        {format(new Date(ev.start_ts), 'HH:mm')} - {format(new Date(ev.end_ts), 'HH:mm')}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDuration((new Date(ev.end_ts).getTime() - new Date(ev.start_ts).getTime()) / 60000)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isBulk ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">วิธีแบ่งจำนวน</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSplitMode('proportional')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-xs',
                        splitMode === 'proportional'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <SplitSquareHorizontal className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium">ตามสัดส่วนเวลา</div>
                        <div className="text-[10px] opacity-70 mt-0.5">แบ่งตามระยะเวลาแต่ละเหตุการณ์</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('equal')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-xs',
                        splitMode === 'equal'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <Equal className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-medium">แบ่งเท่าๆ กัน</div>
                        <div className="text-[10px] opacity-70 mt-0.5">แบ่งเท่ากันทุกเหตุการณ์</div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                  บันทึกจำนวนผลิตสำหรับเหตุการณ์นี้
                </div>
              )}

              <AddCountsForm
                defectReasons={defectReasons}
                onSubmit={(data) => {
                  if (isBulk) bulkCountsMutation.mutate(data);
                  else addCountsMutation.mutate(data);
                }}
                isLoading={isBulk ? bulkCountsMutation.isPending : addCountsMutation.isPending}
                onValuesChange={isBulk ? (g, r) => { setFormGoodQty(g); setFormRejectQty(r); } : undefined}
                previewSlot={isBulk && (formGoodQty > 0 || formRejectQty > 0) ? (
                  <SplitPreview
                    events={eventsInScope}
                    goodQty={formGoodQty}
                    rejectQty={formRejectQty}
                    splitMode={splitMode}
                  />
                ) : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Render: group-select view (pick events within a group)
  if (viewMode === 'group-select' && selectedGroup) {
    return (
      <AppLayout>
        <div className="page-container space-y-5">
          <PageHeader title="รอบันทึกจำนวนผลิต" description="เหตุการณ์ RUN ที่จบแล้วแต่ยังไม่ได้บันทึกจำนวนผลิต" icon={ClipboardList} />

          <Button variant="ghost" size="sm" onClick={resetView} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            กลับ
          </Button>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-running/10">
                  <Layers className="h-5 w-5 text-status-running" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {selectedGroup.machine_name}{' '}
                    <span className="text-xs font-mono text-muted-foreground">({selectedGroup.machine_code})</span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedGroup.product_name && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {selectedGroup.product_name}
                        {selectedGroup.product_code && <span className="font-mono">({selectedGroup.product_code})</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                เลือกเหตุการณ์ที่ต้องการบันทึกจำนวนผลิตรวม
              </p>

              {/* Select all toggle */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Checkbox
                    checked={selectedEventIds.size === selectedGroup.events.length}
                    onCheckedChange={handleToggleAll}
                  />
                  เลือกทั้งหมด ({selectedGroup.events.length})
                </button>
                <Badge variant="secondary">
                  เลือกแล้ว {selectedEventIds.size} รายการ
                </Badge>
              </div>

              {/* Event list with checkboxes */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {selectedGroup.events.map(ev => {
                  const checked = selectedEventIds.has(ev.id);
                  const durationMs = new Date(ev.end_ts).getTime() - new Date(ev.start_ts).getTime();
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleToggleEvent(ev.id)}
                      className={cn(
                        'w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3',
                        checked
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border bg-card hover:bg-muted/30',
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => handleToggleEvent(ev.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono">
                              {format(new Date(ev.start_ts), 'HH:mm')} - {format(new Date(ev.end_ts), 'HH:mm')}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(durationMs / 60000)}
                          </span>
                        </div>
                        {ev.staff_name && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <User className="h-3 w-3" />
                            {ev.staff_name}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleProceedToForm}
                disabled={selectedEventIds.size === 0}
                className="w-full"
              >
                <Layers className="h-4 w-4 mr-2" />
                บันทึกจำนวนผลิตรวม ({selectedEventIds.size} เหตุการณ์)
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Render: main list view (grouped by date → machine+SKU)
  return (
    <AppLayout>
      <div className="page-container space-y-5">
        <div className="flex items-center justify-between">
          <PageHeader
            title="รอบันทึกจำนวนผลิต"
            description="เหตุการณ์ RUN ที่จบแล้วแต่ยังไม่ได้บันทึกจำนวนผลิต"
            icon={ClipboardList}
          />
          {filterMachineId && (
            <Button variant="outline" size="sm" onClick={() => navigate('/supervisor')} className="gap-2 shrink-0">
              <ChevronLeft className="h-4 w-4" />
              กลับหน้า Supervisor
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {totalPending > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-status-pending/30 bg-status-pending/5 px-4 py-3">
              <ClipboardList className="h-5 w-5 text-status-pending shrink-0" />
              <span className="text-sm font-medium text-status-pending">
                มี {totalPending} เหตุการณ์ที่รอบันทึกจำนวนผลิต
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : totalPending === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CheckCircle2 className="h-16 w-16 mb-4 text-green-500" />
                <p className="font-semibold text-lg">บันทึกจำนวนผลิตครบแล้ว</p>
                <p className="text-sm mt-1">ไม่มีเหตุการณ์ที่รอบันทึก</p>
              </CardContent>
            </Card>
          ) : (
            groupedByDate.map(({ date, runs, groups }) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {format(new Date(date), 'EEEE d MMMM yyyy', { locale: th })}
                  </h3>
                  <Badge variant="secondary" className="text-xs">{runs.length}</Badge>
                </div>

                <div className="space-y-2">
                  {groups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => handleGroupClick(group)}
                      className={cn(
                        'w-full text-left rounded-xl border-2 border-status-pending/30 bg-status-pending/5 p-4 transition-all',
                        'hover:border-status-pending/60 hover:bg-status-pending/10 active:scale-[0.99]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-running/10">
                            {group.events.length > 1
                              ? <Layers className="h-5 w-5 text-status-running" />
                              : <Play className="h-5 w-5 text-status-running" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-sm">{group.machine_name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">({group.machine_code})</span>
                              {group.events.length > 1 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {group.events.length} เหตุการณ์
                                </Badge>
                              )}
                            </div>
                            {group.plant_name && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Factory className="h-3 w-3 shrink-0" />
                                <span>{group.plant_name}</span>
                              </div>
                            )}
                            {group.product_name ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Package className="h-3 w-3 shrink-0" />
                                <span className="truncate">{group.product_name}</span>
                                {group.product_code && <span className="font-mono text-[10px]">({group.product_code})</span>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">ไม่ระบุ SKU</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {group.events.length > 1 ? (
                            <>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>รวม {formatDuration(group.totalMinutes)}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary mt-1">
                                บันทึกรวมได้
                              </Badge>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="font-mono">
                                  {format(new Date(group.events[0].start_ts), 'HH:mm')} - {format(new Date(group.events[0].end_ts), 'HH:mm')}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[10px] border-status-pending/40 text-status-pending mt-1">
                                รอบันทึก
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
