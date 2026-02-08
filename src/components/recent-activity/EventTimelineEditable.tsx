import { useState, useMemo, useCallback } from 'react';
import { format, differenceInSeconds, differenceInMinutes } from 'date-fns';
import {
  Play, Pause, Wrench, Clock, Timer, Package, Trash2,
  Check, X, Loader2, AlertTriangle, User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { InlineTimeInput } from './InlineTimeInput';
import { useUpdateEvent } from './useUpdateEvent';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface TimelineEvent {
  id: string;
  event_type: 'RUN' | 'DOWNTIME' | 'SETUP';
  start_ts: string;
  end_ts: string | null;
  notes: string | null;
  machine_id: string;
  product_id: string | null;
  reason_id: string | null;
  created_by: string;
  machine?: { name: string; code: string } | null;
  product?: { name: string; code: string } | null;
  reason?: { name: string; category: string } | null;
  creator?: { full_name: string } | null;
}

const EVENT_CONFIG: Record<string, {
  label: string;
  icon: typeof Play;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  RUN: {
    label: 'Running',
    icon: Play,
    color: 'bg-status-running',
    bgColor: 'bg-status-running/5',
    borderColor: 'border-status-running/20',
  },
  DOWNTIME: {
    label: 'Downtime',
    icon: Pause,
    color: 'bg-status-stopped',
    bgColor: 'bg-status-stopped/5',
    borderColor: 'border-status-stopped/20',
  },
  SETUP: {
    label: 'Setup',
    icon: Wrench,
    color: 'bg-status-idle',
    bgColor: 'bg-status-idle/5',
    borderColor: 'border-status-idle/20',
  },
};

/** Convert ISO string to local "HH:MM:SS" */
function toLocalTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '00:00:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Convert ISO string to local "YYYY-MM-DDTHH:MM:SS" */
function toLocalDatetime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return 'ไม่ถูกต้อง';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

// --- Single editable event row ---
function TimelineEventRow({
  event,
  editable,
  showActor,
  onDelete,
}: {
  event: TimelineEvent;
  editable: boolean;
  showActor: boolean;
  onDelete?: (event: TimelineEvent) => void;
}) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.RUN;
  const Icon = config.icon;
  const isOngoing = !event.end_ts;

  const startTime = new Date(event.start_ts);
  const endTime = event.end_ts ? new Date(event.end_ts) : null;
  const duration = endTime
    ? differenceInMinutes(endTime, startTime)
    : differenceInMinutes(new Date(), startTime);

  // Inline edit state
  const origStartLocal = toLocalDatetime(event.start_ts);
  const origEndLocal = event.end_ts ? toLocalDatetime(event.end_ts) : '';
  const origStartTime = origStartLocal.split('T')[1] || '00:00:00';
  const origEndTime = origEndLocal ? origEndLocal.split('T')[1] || '00:00:00' : '00:00:00';

  const [editStartTime, setEditStartTime] = useState(origStartTime);
  const [editEndTime, setEditEndTime] = useState(origEndTime);
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);

  const hasChanged = editStartTime !== origStartTime || (origEndLocal && editEndTime !== origEndTime);

  const buildFullDatetime = useCallback((timePart: string, origFull: string) => {
    const datePart = origFull.split('T')[0];
    if (!datePart) return '';
    return `${datePart}T${timePart}`;
  }, []);

  const mutation = useUpdateEvent();

  const handleSave = useCallback(() => {
    if (hasChanged) setShowCascadeConfirm(true);
  }, [hasChanged]);

  const handleConfirmSave = useCallback(() => {
    setShowCascadeConfirm(false);
    const newStartFull = buildFullDatetime(editStartTime, origStartLocal);
    const newEndFull = origEndLocal ? buildFullDatetime(editEndTime, origEndLocal) : null;
    mutation.mutate({
      eventId: event.id,
      eventType: event.event_type,
      startTs: new Date(newStartFull).toISOString(),
      endTs: newEndFull ? new Date(newEndFull).toISOString() : null,
      notes: event.notes,
    });
  }, [editStartTime, editEndTime, origStartLocal, origEndLocal, buildFullDatetime, event, mutation]);

  const handleCancel = useCallback(() => {
    setEditStartTime(origStartTime);
    setEditEndTime(origEndTime);
  }, [origStartTime, origEndTime]);

  // Compute edited duration
  const editedDuration = useMemo(() => {
    if (!origEndLocal) return null;
    const startFull = buildFullDatetime(editStartTime, origStartLocal);
    const endFull = buildFullDatetime(editEndTime, origEndLocal);
    return differenceInSeconds(new Date(endFull), new Date(startFull));
  }, [editStartTime, editEndTime, origStartLocal, origEndLocal, buildFullDatetime]);

  return (
    <>
      <div className="relative flex gap-4">
        {/* Timeline dot */}
        <div className={cn(
          'relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0',
          config.color,
          isOngoing && 'ring-4 ring-offset-2 ring-offset-background animate-pulse',
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>

        {/* Content */}
        <div className={cn(
          'flex-1 rounded-lg border p-3',
          config.bgColor,
          config.borderColor,
        )}>
          {/* Header: type + badges + duration + delete */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant={isOngoing ? 'default' : 'secondary'}>
              {config.label}
            </Badge>
            {event.product && (
              <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                <Package className="h-3 w-3" />
                {event.product.name}
              </Badge>
            )}
            {isOngoing && (
              <Badge variant="outline" className="animate-pulse border-status-running/40 text-status-running">
                กำลังดำเนินการ
              </Badge>
            )}

            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto shrink-0">
              <Timer className="h-3 w-3" />
              <span>{duration} นาที</span>
            </div>

            {editable && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => onDelete(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Inline time editing */}
          <div className="flex items-center gap-3 flex-wrap bg-background/60 rounded-lg px-3 py-2 border border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium min-w-[2.5rem]">เริ่ม</span>
              <InlineTimeInput
                value={editStartTime}
                onChange={setEditStartTime}
                disabled={!editable || mutation.isPending}
              />
            </div>
            <span className="text-muted-foreground font-bold">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium min-w-[3rem]">สิ้นสุด</span>
              {origEndLocal ? (
                <InlineTimeInput
                  value={editEndTime}
                  onChange={setEditEndTime}
                  disabled={!editable || mutation.isPending}
                />
              ) : (
                <span className="text-sm font-mono text-muted-foreground">--:--:--</span>
              )}
            </div>

            {/* Duration badge */}
            {editedDuration != null && (
              <Badge variant="secondary" className={cn(
                "text-[10px] gap-1 px-1.5 py-0",
                editedDuration < 0 && "bg-destructive/10 text-destructive",
              )}>
                <Clock className="h-2.5 w-2.5" />
                {formatDuration(editedDuration)}
              </Badge>
            )}

            {editable && !hasChanged && (
              <span className="text-[10px] text-muted-foreground italic ml-auto hidden sm:inline">
                คลิกที่ตัวเลขเพื่อแก้ไข
              </span>
            )}
          </div>

          {/* Save/Cancel buttons */}
          {hasChanged && editable && (
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleSave}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                บันทึก
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                <X className="h-3 w-3" />
                ยกเลิก
              </Button>
              <span className="text-[10px] text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                event ข้างเคียงจะเลื่อนตาม
              </span>
            </div>
          )}

          {/* Extra details */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
            {event.reason && (
              <span className="flex items-center gap-1">📋 {event.reason.name}</span>
            )}
            {event.notes && <span className="italic">📝 {event.notes}</span>}
            {showActor && event.creator && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {event.creator.full_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cascade confirm dialog */}
      <AlertDialog open={showCascadeConfirm} onOpenChange={setShowCascadeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              ยืนยันการเปลี่ยนเวลา
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>การเปลี่ยนเวลาจะส่งผลต่อ event ข้างเคียงในกะเดียวกัน:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>เวลาสิ้นสุดของ event ก่อนหน้าจะถูกปรับตาม</li>
                <li>เวลาเริ่มของ event ถัดไปจะเลื่อนให้ต่อเนื่อง</li>
              </ul>
              <p className="font-medium">ต้องการดำเนินการต่อหรือไม่?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Main editable timeline ---
interface EventTimelineEditableProps {
  events: TimelineEvent[];
  editable: boolean;
  showActor: boolean;
  onDelete?: (event: TimelineEvent) => void;
}

export function EventTimelineEditable({
  events,
  editable,
  showActor,
  onDelete,
}: EventTimelineEditableProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
        <p className="text-muted-foreground">ไม่มีเหตุการณ์ในช่วงเวลานี้</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map((event) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            editable={editable}
            showActor={showActor}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
