import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Play, PauseCircle, Wrench, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import oeeApi from '@/services/oeeApi';
import type { ProductionEvent, ProductionCount } from '@/services/types';

interface ShiftActivityDetailProps {
  shiftCalendarId: string;
}

const eventTypeConfig: Record<string, { label: string; icon: typeof Play; color: string }> = {
  RUN: { label: 'Running', icon: Play, color: 'text-emerald-600 bg-emerald-500/10' },
  DOWNTIME: { label: 'Downtime', icon: PauseCircle, color: 'text-amber-600 bg-amber-500/10' },
  SETUP: { label: 'Setup', icon: Wrench, color: 'text-blue-600 bg-blue-500/10' },
};

function formatDuration(startTs: string, endTs?: string): string {
  const start = new Date(startTs);
  const end = endTs ? new Date(endTs) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs} ชม. ${remainMins} นาที`;
}

export function ShiftActivityDetail({ shiftCalendarId }: ShiftActivityDetailProps) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const [countsOpen, setCountsOpen] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const toggleEvent = useCallback((id: string) => {
    setExpandedEventId(prev => prev === id ? null : id);
  }, []);

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['shiftEvents', shiftCalendarId],
    queryFn: () => oeeApi.getProductionEventsByShift(shiftCalendarId),
    enabled: eventsOpen,
  });

  const { data: counts = [], isLoading: countsLoading } = useQuery({
    queryKey: ['shiftCounts', shiftCalendarId],
    queryFn: () => oeeApi.getProductionCountsByShift(shiftCalendarId),
    enabled: countsOpen,
  });

  return (
    <div className="space-y-3 pt-2 border-t">
      {/* Events collapsible */}
      <Collapsible open={eventsOpen} onOpenChange={setEventsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-2 h-9 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              เหตุการณ์การผลิต
              {events.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">{events.length}</Badge>
              )}
            </span>
            {eventsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground px-2 py-3">กำลังโหลด...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-3">ไม่มีเหตุการณ์ในกะนี้</p>
          ) : (
            <div className="space-y-1 px-1 pb-2 max-h-[320px] overflow-y-auto">
              {events.map((event) => {
                const config = eventTypeConfig[event.event_type] || eventTypeConfig.RUN;
                const Icon = config.icon;
                const isExpanded = expandedEventId === event.id;
                const hasDetails = event.reason || event.product || event.notes;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => toggleEvent(event.id)}
                    className={cn(
                      'w-full text-left flex flex-col rounded-md border px-3 py-2 text-sm transition-colors',
                      hasDetails ? 'hover:bg-accent/50 cursor-pointer' : 'cursor-default',
                      isExpanded && 'bg-accent/30 border-primary/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5', config.color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{config.label}</span>
                          {event.machine?.name && (
                            <Badge variant="outline" className="text-xs h-5">{event.machine.name}</Badge>
                          )}
                          {hasDetails && !isExpanded && (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                          )}
                          {isExpanded && (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{format(new Date(event.start_ts), 'HH:mm')}</span>
                          <span>→</span>
                          <span>{event.end_ts ? format(new Date(event.end_ts), 'HH:mm') : 'กำลังดำเนินการ'}</span>
                          <span className="text-foreground/70">({formatDuration(event.start_ts, event.end_ts || undefined)})</span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <div className="ml-10 mt-2 space-y-1.5 border-t pt-2">
                        {event.reason && (
                          <div className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-foreground">สาเหตุ: {event.reason.name}</p>
                              <p className="text-muted-foreground">รหัส: {event.reason.code} · หมวด: {event.reason.category}</p>
                            </div>
                          </div>
                        )}
                        {event.product && (
                          <div className="flex items-start gap-2 text-xs">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-foreground">สินค้า: {event.product.name}</p>
                              <p className="text-muted-foreground">รหัส: {event.product.code}</p>
                            </div>
                          </div>
                        )}
                        {event.notes && (
                          <p className="text-xs text-muted-foreground italic pl-5">📝 {event.notes}</p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Counts collapsible */}
      <Collapsible open={countsOpen} onOpenChange={setCountsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-2 h-9 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              จำนวนผลิต
              {counts.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">{counts.length}</Badge>
              )}
            </span>
            {countsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {countsLoading ? (
            <p className="text-sm text-muted-foreground px-2 py-3">กำลังโหลด...</p>
          ) : counts.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-3">ไม่มีข้อมูลจำนวนผลิตในกะนี้</p>
          ) : (
            <div className="overflow-x-auto px-1 pb-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 px-2 font-medium">เวลา</th>
                    <th className="text-left py-1.5 px-2 font-medium">เครื่อง</th>
                    <th className="text-right py-1.5 px-2 font-medium">ดี</th>
                    <th className="text-right py-1.5 px-2 font-medium">เสีย</th>
                    <th className="text-left py-1.5 px-2 font-medium">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((count) => (
                    <tr key={count.id} className="border-b last:border-0">
                      <td className="py-1.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(count.ts), 'HH:mm')}
                      </td>
                      <td className="py-1.5 px-2">
                        <Badge variant="outline" className="text-xs h-5">{count.machine?.name || '-'}</Badge>
                      </td>
                      <td className="py-1.5 px-2 text-right font-medium text-emerald-600">{count.good_qty}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-destructive">{count.reject_qty}</td>
                      <td className="py-1.5 px-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {count.defect_reason?.name || count.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
