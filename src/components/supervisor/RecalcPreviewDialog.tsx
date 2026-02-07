import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Calculator,
  Play,
  Pause,
  Wrench,
  Clock,
  Timer,
  Package,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import oeeApi from '@/services/oeeApi';
import type { ProductionEvent, ProductionCount } from '@/services/types';

interface RecalcPreviewDialogProps {
  shiftCalendarId: string;
  onRecalc: () => void;
  isRecalculating: boolean;
  disabled?: boolean;
}

const eventTypeConfig = {
  RUN: {
    color: 'bg-status-running',
    textColor: 'text-status-running',
    icon: Play,
    label: 'Running',
  },
  DOWNTIME: {
    color: 'bg-status-stopped',
    textColor: 'text-status-stopped',
    icon: Pause,
    label: 'Downtime',
  },
  SETUP: {
    color: 'bg-status-idle',
    textColor: 'text-status-idle',
    icon: Wrench,
    label: 'Setup',
  },
};

interface MachineGroup {
  machineId: string;
  machineName: string;
  machineCode: string;
  events: ProductionEvent[];
  counts: ProductionCount[];
  totalRunMinutes: number;
  totalDowntimeMinutes: number;
  totalSetupMinutes: number;
  totalGoodQty: number;
  totalRejectQty: number;
}

export function RecalcPreviewDialog({
  shiftCalendarId,
  onRecalc,
  isRecalculating,
  disabled,
}: RecalcPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['shift-events-preview', shiftCalendarId],
    queryFn: () => oeeApi.getProductionEventsByShift(shiftCalendarId),
    enabled: open,
  });

  const { data: counts = [], isLoading: loadingCounts } = useQuery({
    queryKey: ['shift-counts-preview', shiftCalendarId],
    queryFn: () => oeeApi.getProductionCountsByShift(shiftCalendarId),
    enabled: open,
  });

  const isLoading = loadingEvents || loadingCounts;

  // Group events and counts by machine
  const machineGroups: MachineGroup[] = (() => {
    const map = new Map<string, MachineGroup>();

    events.forEach((event) => {
      const mId = event.machine_id;
      if (!map.has(mId)) {
        map.set(mId, {
          machineId: mId,
          machineName: event.machine?.name || mId,
          machineCode: event.machine?.code || '',
          events: [],
          counts: [],
          totalRunMinutes: 0,
          totalDowntimeMinutes: 0,
          totalSetupMinutes: 0,
          totalGoodQty: 0,
          totalRejectQty: 0,
        });
      }
      const group = map.get(mId)!;
      group.events.push(event);

      const start = new Date(event.start_ts);
      const end = event.end_ts ? new Date(event.end_ts) : new Date();
      const duration = differenceInMinutes(end, start);

      if (event.event_type === 'RUN') group.totalRunMinutes += duration;
      else if (event.event_type === 'DOWNTIME') group.totalDowntimeMinutes += duration;
      else if (event.event_type === 'SETUP') group.totalSetupMinutes += duration;
    });

    counts.forEach((count) => {
      const mId = count.machine_id;
      if (!map.has(mId)) {
        map.set(mId, {
          machineId: mId,
          machineName: count.machine?.name || mId,
          machineCode: count.machine?.code || '',
          events: [],
          counts: [],
          totalRunMinutes: 0,
          totalDowntimeMinutes: 0,
          totalSetupMinutes: 0,
          totalGoodQty: 0,
          totalRejectQty: 0,
        });
      }
      const group = map.get(mId)!;
      group.counts.push(count);
      group.totalGoodQty += count.good_qty;
      group.totalRejectQty += count.reject_qty;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.machineName.localeCompare(b.machineName)
    );
  })();

  const toggleMachine = (machineId: string) => {
    setExpandedMachines((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  };

  const handleRecalc = () => {
    onRecalc();
    setOpen(false);
  };

  const totalEvents = events.length;
  const totalCountRecords = counts.length;
  const hasNoData = totalEvents === 0 && totalCountRecords === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={isRecalculating || disabled} className="min-w-[140px]">
          {isRecalculating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4 mr-2" />
          )}
          {isRecalculating ? 'กำลังคำนวณ...' : 'คำนวณ OEE'}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            ตรวจสอบข้อมูลก่อนคำนวณ OEE
          </DialogTitle>
          <DialogDescription>
            ตรวจสอบ Production Events และจำนวนผลิตทั้งหมดในกะนี้ก่อนกดยืนยัน
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลกะ...</p>
            </div>
          ) : hasNoData ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">ไม่มีข้อมูล Production Events ในกะนี้</p>
              <p className="text-xs text-muted-foreground">
                การคำนวณ OEE จะได้ค่าเป็น 0% ทั้งหมด
              </p>
            </div>
          ) : (
            <>
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {machineGroups.length} เครื่องจักร
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {totalEvents} events
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  {totalCountRecords} records ผลิต
                </Badge>
              </div>

              {/* Machine groups */}
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-3">
                  {machineGroups.map((group) => {
                    const isExpanded = expandedMachines.has(group.machineId);
                    return (
                      <div
                        key={group.machineId}
                        className="rounded-lg border bg-card"
                      >
                        {/* Machine header - clickable */}
                        <button
                          onClick={() => toggleMachine(group.machineId)}
                          className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="font-medium text-sm">
                              {group.machineName}
                              {group.machineCode && (
                                <span className="text-muted-foreground ml-1.5 font-normal">
                                  ({group.machineCode})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Quick stat chips */}
                            <div className="flex gap-2 text-xs">
                              {group.totalRunMinutes > 0 && (
                                <span className="flex items-center gap-1 text-status-running">
                                  <Play className="h-3 w-3" />
                                  {group.totalRunMinutes}m
                                </span>
                              )}
                              {group.totalDowntimeMinutes > 0 && (
                                <span className="flex items-center gap-1 text-status-stopped">
                                  <Pause className="h-3 w-3" />
                                  {group.totalDowntimeMinutes}m
                                </span>
                              )}
                              {group.totalSetupMinutes > 0 && (
                                <span className="flex items-center gap-1 text-status-idle">
                                  <Wrench className="h-3 w-3" />
                                  {group.totalSetupMinutes}m
                                </span>
                              )}
                              {(group.totalGoodQty > 0 || group.totalRejectQty > 0) && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Package className="h-3 w-3" />
                                  {group.totalGoodQty}
                                  {group.totalRejectQty > 0 && (
                                    <span className="text-status-stopped">
                                      /{group.totalRejectQty}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Expanded events */}
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-2">
                            <Separator />
                            {/* Events list */}
                            {group.events.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Events
                                </p>
                                {group.events.map((event) => {
                                  const config = eventTypeConfig[event.event_type];
                                  const Icon = config.icon;
                                  const start = new Date(event.start_ts);
                                  const end = event.end_ts
                                    ? new Date(event.end_ts)
                                    : null;
                                  const duration = end
                                    ? differenceInMinutes(end, start)
                                    : differenceInMinutes(new Date(), start);
                                  const isOngoing = !event.end_ts;

                                  return (
                                    <div
                                      key={event.id}
                                      className="flex items-center gap-2.5 rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
                                    >
                                      <div
                                        className={cn(
                                          'flex items-center justify-center h-6 w-6 rounded-full shrink-0',
                                          config.color
                                        )}
                                      >
                                        <Icon className="h-3 w-3 text-white" />
                                      </div>
                                      <span className={cn('font-medium text-xs w-16', config.textColor)}>
                                        {config.label}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(start, 'HH:mm')}
                                        {end ? ` - ${format(end, 'HH:mm')}` : ''}
                                      </span>
                                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                        <Timer className="h-3 w-3" />
                                        {duration}m
                                      </span>
                                      {event.product && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                          {event.product.name}
                                        </Badge>
                                      )}
                                      {event.reason && (
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          {event.reason.name}
                                        </span>
                                      )}
                                      {isOngoing && (
                                        <Badge className="text-[10px] px-1.5 py-0 h-5 animate-pulse">
                                          กำลังทำงาน
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Counts */}
                            {group.counts.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Production Counts
                                </p>
                                {group.counts.map((count) => (
                                  <div
                                    key={count.id}
                                    className="flex items-center gap-2.5 rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
                                  >
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full shrink-0 bg-primary/80">
                                      <Package className="h-3 w-3 text-white" />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(count.ts), 'HH:mm')}
                                    </span>
                                    <span className="text-xs">
                                      Good: <span className="font-medium text-status-running">{count.good_qty}</span>
                                    </span>
                                    {count.reject_qty > 0 && (
                                      <span className="text-xs">
                                        Reject: <span className="font-medium text-status-stopped">{count.reject_qty}</span>
                                      </span>
                                    )}
                                    {count.defect_reason && (
                                      <span className="text-[10px] text-muted-foreground truncate">
                                        {(count.defect_reason as any).name}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline">ยกเลิก</Button>
          </DialogClose>
          <Button onClick={handleRecalc} disabled={isRecalculating}>
            {isRecalculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            ยืนยันคำนวณ OEE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
