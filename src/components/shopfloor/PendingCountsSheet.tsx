import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddCountsForm } from './AddCountsForm';
import { cn } from '@/lib/utils';
import { Clock, Package, Play, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import type { DefectReason } from '@/services/types';

export interface PendingEvent {
  id: string;
  event_type: string;
  start_ts: string;
  end_ts: string | null;
  product_id: string | null;
  products?: { name: string; code: string } | null;
  notes?: string | null;
}

interface PendingCountsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingEvents: PendingEvent[];
  defectReasons: DefectReason[];
  onSubmitCounts: (data: {
    goodQty: number;
    rejectQty: number;
    defectBreakdowns?: { reasonId: string; qty: number }[];
    notes?: string;
  }) => void;
  isSubmitting?: boolean;
  isLocked?: boolean;
}

function formatDuration(startTs: string, endTs: string): string {
  const ms = new Date(endTs).getTime() - new Date(startTs).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

function formatTime(ts: string): string {
  return format(new Date(ts), 'HH:mm');
}

export function PendingCountsSheet({
  open,
  onOpenChange,
  pendingEvents,
  defectReasons,
  onSubmitCounts,
  isSubmitting = false,
  isLocked = false,
}: PendingCountsSheetProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = pendingEvents.find(e => e.id === selectedEventId);

  const handleClose = () => {
    setSelectedEventId(null);
    onOpenChange(false);
  };

  const handleSubmit = (data: {
    goodQty: number;
    rejectQty: number;
    defectBreakdowns?: { reasonId: string; qty: number }[];
    notes?: string;
  }) => {
    onSubmitCounts(data);
    setSelectedEventId(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          {selectedEvent ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedEventId(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <SheetTitle className="text-base">บันทึกจำนวนผลิต</SheetTitle>
                <SheetDescription className="text-xs">
                  {selectedEvent.products?.name || 'ไม่ระบุ SKU'} • {formatTime(selectedEvent.start_ts)} - {selectedEvent.end_ts ? formatTime(selectedEvent.end_ts) : '-'}
                </SheetDescription>
              </div>
            </div>
          ) : (
            <>
              <SheetTitle className="text-base">เหตุการณ์ที่รอบันทึกจำนวนผลิต</SheetTitle>
              <SheetDescription className="text-xs">
                เลือกเหตุการณ์ RUN ที่จบแล้วเพื่อบันทึกจำนวนผลิต ({pendingEvents.length} รายการ)
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          {selectedEvent ? (
            <AddCountsForm
              defectReasons={defectReasons}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              isLocked={isLocked}
            />
          ) : (
            <div className="space-y-3">
              {pendingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-3 text-green-500" />
                  <p className="font-medium">บันทึกจำนวนผลิตครบแล้ว</p>
                  <p className="text-xs mt-1">ไม่มีเหตุการณ์ที่รอบันทึก</p>
                </div>
              ) : (
                pendingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
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
                            <span className="font-semibold text-sm">RUN</span>
                            <Badge variant="outline" className="text-[10px] border-status-pending/40 text-status-pending">
                              รอบันทึก
                            </Badge>
                          </div>
                          {event.products ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Package className="h-3 w-3 shrink-0" />
                              <span className="truncate">{event.products.name}</span>
                              <span className="font-mono text-[10px]">({event.products.code})</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">ไม่ระบุ SKU</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">{formatTime(event.start_ts)} - {event.end_ts ? formatTime(event.end_ts) : '-'}</span>
                        </div>
                        {event.end_ts && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            ({formatDuration(event.start_ts, event.end_ts)})
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
