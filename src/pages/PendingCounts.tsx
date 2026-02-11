import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { useAuth } from '@/hooks/useAuth';
import { getDefectReasons, addCountsBackdate } from '@/services';
import { cn } from '@/lib/utils';
import { ClipboardList, Play, Package, Clock, ChevronLeft, CheckCircle2, Calendar, Factory, User } from 'lucide-react';
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

export default function PendingCounts() {
  const queryClient = useQueryClient();
  const { company, isAdmin, hasRole } = useAuth();
  const companyId = company?.id;
  const [selectedEvent, setSelectedEvent] = useState<PendingRun | null>(null);

  // Fetch all pending RUN events (completed, no counts) across all permitted machines
  const { data: pendingRuns = [], isLoading } = useQuery({
    queryKey: ['pending-counts-all', companyId],
    queryFn: async () => {
      // Get machines with line→plant info
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

      // Get completed RUN events with shift_calendar info and created_by
      const { data: runEvents, error: eErr } = await supabase
        .from('production_events')
        .select('id, machine_id, event_type, start_ts, end_ts, product_id, shift_calendar_id, created_by, products(name, code), shift_calendar!inner(shift_date)')
        .in('machine_id', machineIds)
        .eq('event_type', 'RUN')
        .not('end_ts', 'is', null)
        .order('start_ts', { ascending: false });

      if (eErr) throw eErr;
      if (!runEvents?.length) return [];

      // Fetch staff profiles for created_by
      const creatorIds = [...new Set(runEvents.map(e => e.created_by).filter(Boolean))];
      const { data: profiles } = creatorIds.length > 0
        ? await supabase.from('user_profiles').select('user_id, full_name').in('user_id', creatorIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Get shift_calendar_ids with counts
      const scIds = [...new Set(runEvents.map(e => e.shift_calendar_id).filter(Boolean))];
      const { data: countsData } = await supabase
        .from('production_counts')
        .select('machine_id, shift_calendar_id')
        .in('machine_id', machineIds)
        .in('shift_calendar_id', scIds as string[]);

      // Build set of machine+shift combos that have counts
      const hasCountsSet = new Set<string>();
      for (const c of countsData || []) {
        hasCountsSet.add(`${c.machine_id}::${c.shift_calendar_id}`);
      }

      // Filter to events without counts
      const results: PendingRun[] = [];
      for (const ev of runEvents) {
        const key = `${ev.machine_id}::${ev.shift_calendar_id}`;
        if (hasCountsSet.has(key)) continue;

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

  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons', companyId],
    queryFn: () => getDefectReasons(companyId),
  });

  const addCountsMutation = useMutation({
    mutationFn: async (data: { goodQty: number; rejectQty: number; defectReasonId?: string; notes?: string }) => {
      if (!selectedEvent) throw new Error('No event selected');
      // Use the event's end_ts as timestamp and its shift_calendar_id for backdated recording
      return addCountsBackdate(
        selectedEvent.machine_id,
        data.goodQty,
        data.rejectQty,
        data.defectReasonId,
        data.notes,
        selectedEvent.shift_calendar_id || undefined,
        selectedEvent.end_ts
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('บันทึกจำนวนผลิตสำเร็จ');
        setSelectedEvent(null);
        queryClient.invalidateQueries({ queryKey: ['pending-counts-all'] });
        queryClient.invalidateQueries({ queryKey: ['productionCounts'] });
        queryClient.invalidateQueries({ queryKey: ['monitor-machines'] });
      } else {
        toast.error(data.message || 'ไม่สามารถบันทึกได้');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    },
  });

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, PendingRun[]>();
    for (const run of pendingRuns) {
      const date = run.shift_date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(run);
    }
    // Sort dates descending
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pendingRuns]);

  const totalPending = pendingRuns.length;

  return (
    <AppLayout>
      <div className="page-container space-y-5">
        <PageHeader
          title="รอบันทึกจำนวนผลิต"
          description="เหตุการณ์ RUN ที่จบแล้วแต่ยังไม่ได้บันทึกจำนวนผลิต"
          icon={ClipboardList}
        />

        {selectedEvent ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              กลับ
            </Button>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-running/10">
                    <Play className="h-5 w-5 text-status-running" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedEvent.machine_name} <span className="text-xs font-mono text-muted-foreground">({selectedEvent.machine_code})</span></h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedEvent.start_ts), 'HH:mm')} - {format(new Date(selectedEvent.end_ts), 'HH:mm')}
                      {selectedEvent.product_name && (
                        <>
                          <span>•</span>
                          <Package className="h-3 w-3" />
                          {selectedEvent.product_name}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <AddCountsForm
                  defectReasons={defectReasons}
                  onSubmit={(data) => addCountsMutation.mutate(data)}
                  isLoading={addCountsMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
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
              groupedByDate.map(([date, runs]) => (
                <div key={date} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {format(new Date(date), 'EEEE d MMMM yyyy', { locale: th })}
                    </h3>
                    <Badge variant="secondary" className="text-xs">{runs.length}</Badge>
                  </div>

                  <div className="space-y-2">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => setSelectedEvent(run)}
                        className={cn(
                          'w-full text-left rounded-xl border-2 border-status-pending/30 bg-status-pending/5 p-4 transition-all',
                          'hover:border-status-pending/60 hover:bg-status-pending/10 active:scale-[0.99]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-running/10">
                              <Play className="h-5 w-5 text-status-running" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm">{run.machine_name}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">({run.machine_code})</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                {run.plant_name && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Factory className="h-3 w-3 shrink-0" />
                                    <span>{run.plant_name}</span>
                                  </div>
                                )}
                                {run.staff_name && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>{run.staff_name}</span>
                                  </div>
                                )}
                              </div>
                              {run.product_name ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Package className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{run.product_name}</span>
                                  {run.product_code && <span className="font-mono text-[10px]">({run.product_code})</span>}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">ไม่ระบุ SKU</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="font-mono">
                                {format(new Date(run.start_ts), 'HH:mm')} - {format(new Date(run.end_ts), 'HH:mm')}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-status-pending/40 text-status-pending mt-1">
                              รอบันทึก
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
