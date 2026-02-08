import { useState, useMemo, useCallback } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  ChevronDown, ChevronRight, Clock, User, Cpu, Play, Pause, Wrench,
  Hash, Package, Trash2, Check, X, Loader2, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InlineTimeInput } from './InlineTimeInput';
import { useUpdateEvent } from './useUpdateEvent';
import type { ActivitySession } from './groupActivities';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  actor_name: string | null;
  actor_user_id: string | null;
  ts: string;
}

interface LookupData {
  machines: Map<string, { name: string; code: string }>;
  products: Map<string, { name: string; code: string }>;
  reasons: Map<string, { name: string; category: string }>;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Play; colorClass: string; bgClass: string }> = {
  RUN: { label: 'Running', icon: Play, colorClass: 'text-status-running', bgClass: 'bg-status-running/10 border-status-running/20' },
  DOWNTIME: { label: 'Downtime', icon: Pause, colorClass: 'text-destructive', bgClass: 'bg-destructive/10 border-destructive/20' },
  SETUP: { label: 'Setup', icon: Wrench, colorClass: 'text-warning', bgClass: 'bg-warning/10 border-warning/20' },
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
};

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

function getActionBadge(action: string) {
  switch (action) {
    case 'INSERT':
      return <Badge className="bg-status-running/10 text-status-running border-status-running/20 text-[10px] px-1.5 py-0">{ACTION_LABELS[action]}</Badge>;
    case 'UPDATE':
      return <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">{ACTION_LABELS[action]}</Badge>;
    case 'DELETE':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">{ACTION_LABELS[action]}</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{action}</Badge>;
  }
}

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

// --- Single log entry with inline editing ---
function SessionLogEntry({
  log, lookup, editable, onDelete,
}: {
  log: AuditLog;
  lookup: LookupData;
  editable: boolean;
  onDelete: (log: AuditLog) => void;
}) {
  const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;

  const eventInfo = useMemo(() => {
    if (log.entity_type !== 'production_events') return null;
    const eventType = data?.event_type as string;
    const config = EVENT_TYPE_CONFIG[eventType];
    const startTs = data?.start_ts as string | null;
    const endTs = data?.end_ts as string | null;
    const isOngoing = startTs && !endTs && log.action !== 'DELETE';
    const productId = data?.product_id as string | null;
    const product = productId ? lookup.products.get(productId) : null;
    const reasonId = data?.reason_id as string | null;
    const reason = reasonId ? lookup.reasons.get(reasonId) : null;
    const notes = data?.notes as string | null;
    return { config, eventType, startTs, endTs, isOngoing, product, reason, notes };
  }, [log, data, lookup]);

  // Inline edit state
  const origStartLocal = eventInfo?.startTs ? toLocalDatetime(eventInfo.startTs) : '';
  const origEndLocal = eventInfo?.endTs ? toLocalDatetime(eventInfo.endTs) : '';
  const origStartTime = origStartLocal ? origStartLocal.split('T')[1] || '00:00:00' : '00:00:00';
  const origEndTime = origEndLocal ? origEndLocal.split('T')[1] || '00:00:00' : '00:00:00';

  const [editStartTime, setEditStartTime] = useState(origStartTime);
  const [editEndTime, setEditEndTime] = useState(origEndTime);
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);

  const hasChanged = editStartTime !== origStartTime || editEndTime !== origEndTime;

  // Build full datetime strings for save
  const buildFullDatetime = useCallback((timePart: string, origFull: string) => {
    const datePart = origFull.split('T')[0];
    if (!datePart) return '';
    return `${datePart}T${timePart}`;
  }, []);

  const mutation = useUpdateEvent(() => {
    // Reset to new values after success — the query invalidation will refetch
  });

  const handleSave = useCallback(() => {
    if (hasChanged) {
      setShowCascadeConfirm(true);
    }
  }, [hasChanged]);

  const handleConfirmSave = useCallback(() => {
    setShowCascadeConfirm(false);
    if (!eventInfo) return;
    const newStartFull = buildFullDatetime(editStartTime, origStartLocal);
    const newEndFull = origEndLocal ? buildFullDatetime(editEndTime, origEndLocal) : null;
    mutation.mutate({
      eventId: log.entity_id,
      eventType: eventInfo.eventType,
      startTs: new Date(newStartFull).toISOString(),
      endTs: newEndFull ? new Date(newEndFull).toISOString() : null,
      notes: eventInfo.notes,
    });
  }, [eventInfo, editStartTime, editEndTime, origStartLocal, origEndLocal, buildFullDatetime, log.entity_id, mutation]);

  const handleCancel = useCallback(() => {
    setEditStartTime(origStartTime);
    setEditEndTime(origEndTime);
  }, [origStartTime, origEndTime]);

  // Compute edited duration
  const editedDuration = useMemo(() => {
    if (!origStartLocal || !origEndLocal) return null;
    const startFull = buildFullDatetime(editStartTime, origStartLocal);
    const endFull = buildFullDatetime(editEndTime, origEndLocal);
    const diff = differenceInSeconds(new Date(endFull), new Date(startFull));
    return diff;
  }, [editStartTime, editEndTime, origStartLocal, origEndLocal, buildFullDatetime]);

  if (!eventInfo) return null;

  const { config, isOngoing, product, reason, notes } = eventInfo;

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 -mx-2 transition-colors hover:bg-muted/30">
        {/* Icon */}
        <div className="flex flex-col items-center pt-0.5 shrink-0">
          {config ? (
            <div className={cn('h-9 w-9 rounded-full flex items-center justify-center border', config.bgClass)}>
              {(() => { const Icon = config.icon; return <Icon className={cn('h-4 w-4', config.colorClass)} />; })()}
            </div>
          ) : (
            <div className="h-9 w-9 rounded-full flex items-center justify-center border bg-muted">
              <Hash className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Event type + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {config && (
              <span className={cn('text-sm font-semibold', config.colorClass)}>
                {config.label}
              </span>
            )}
            {getActionBadge(log.action)}
            {isOngoing && (
              <Badge variant="outline" className="text-[10px] animate-pulse border-status-running/40 text-status-running px-1.5 py-0">
                กำลังดำเนินการ
              </Badge>
            )}

            {/* Delete button */}
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive ml-auto"
                onClick={() => onDelete(log)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Row 2: Inline time inputs */}
          <div className="flex items-center gap-3 flex-wrap bg-muted/40 rounded-lg px-3 py-2 border border-border/50">
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

            {/* Duration */}
            {editedDuration != null && (
              <Badge variant="secondary" className={cn("text-[10px] gap-1 px-1.5 py-0", editedDuration < 0 && "bg-destructive/10 text-destructive")}>
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

          {/* Row 3: Save/Cancel when changed */}
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
                event ถัดไปจะเลื่อนตาม
              </span>
            </div>
          )}

          {/* Row 4: Extra details */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {product && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {product.name}
              </span>
            )}
            {reason && (
              <span className="flex items-center gap-1">📋 {reason.name}</span>
            )}
            {notes && <span className="italic">📝 {notes}</span>}
          </div>
        </div>
      </div>

      {/* Cascade confirm */}
      <AlertDialog open={showCascadeConfirm} onOpenChange={setShowCascadeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              ยืนยันการเปลี่ยนเวลา
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>การเปลี่ยนเวลาจะส่งผลต่อ event ถัดไปในกะเดียวกัน:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>เวลาสิ้นสุดของ event ก่อนหน้าจะถูกปรับตาม</li>
                <li>event ถัดไปทั้งหมดจะเลื่อนเวลาโดยคง duration เดิม</li>
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

// --- Session Card ---
interface ActivitySessionCardProps {
  session: ActivitySession;
  showActor: boolean;
  lookup: LookupData;
  canEditFn: (log: AuditLog) => boolean;
  onDelete: (log: AuditLog) => void;
}

export function ActivitySessionCard({
  session, showActor, lookup, canEditFn, onDelete,
}: ActivitySessionCardProps) {
  const isSingleEntry = session.logs.length === 1;
  const [isExpanded, setIsExpanded] = useState(true);

  const machine = session.machineId ? lookup.machines.get(session.machineId) : null;
  const sessionDuration = differenceInSeconds(new Date(session.endTs), new Date(session.startTs));

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      {/* Session Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        
        {machine && (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            {machine.name}
            <span className="text-xs font-mono text-muted-foreground">({machine.code})</span>
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
            {session.logs.length} รายการ
          </Badge>
          {sessionDuration > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              <Clock className="h-2.5 w-2.5" />
              {formatDuration(sessionDuration)}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground font-mono">
            {format(new Date(session.endTs), 'HH:mm')}
            {sessionDuration > 0 && ` — ${format(new Date(session.startTs), 'HH:mm')}`}
          </span>
        </div>
      </button>

      {/* Actor info */}
      {showActor && session.actorName && (
        <div className="px-4 py-1 bg-muted/20 border-b text-xs text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" />
          {session.actorName}
        </div>
      )}

      {/* Expanded log entries */}
      {isExpanded && (
        <div className="px-4 pt-2 pb-1 border-t border-border/50 divide-y divide-border/30">
          {session.logs.map((log) => (
            <SessionLogEntry
              key={log.id}
              log={log}
              lookup={lookup}
              editable={canEditFn(log)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
