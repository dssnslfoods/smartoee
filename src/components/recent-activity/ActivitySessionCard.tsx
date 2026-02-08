import { useState, useMemo } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  ChevronDown, ChevronRight, Clock, User, Cpu, Play, Pause, Wrench,
  Hash, Package, Pencil, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActivitySession } from './groupActivities';

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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  production_events: 'เหตุการณ์การผลิต',
  production_counts: 'บันทึกจำนวนผลิต',
  shift_approvals: 'อนุมัติกะ',
  oee_snapshots: 'OEE Snapshot',
  machines: 'เครื่องจักร',
  lines: 'ไลน์',
  plants: 'โรงงาน',
  products: 'สินค้า',
  production_standards: 'มาตรฐานการผลิต',
  shifts: 'กะการทำงาน',
  downtime_reasons: 'สาเหตุหยุดเครื่อง',
  defect_reasons: 'สาเหตุของเสีย',
};

function formatDuration(seconds: number): string {
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

// --- Single log entry inside a session ---
function formatTimeLocal(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function SessionLogEntry({
  log, lookup, editable, onEdit, onDelete,
}: {
  log: AuditLog;
  lookup: LookupData;
  editable: boolean;
  onEdit: (log: AuditLog) => void;
  onDelete: (log: AuditLog) => void;
}) {
  const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;

  const description = useMemo(() => {
    if (log.entity_type === 'production_events') {
      const eventType = data?.event_type as string;
      const config = EVENT_TYPE_CONFIG[eventType];
      const startTs = data?.start_ts as string | null;
      const endTs = data?.end_ts as string | null;
      const duration = startTs && endTs ? differenceInSeconds(new Date(endTs), new Date(startTs)) : null;
      const isOngoing = startTs && !endTs && log.action !== 'DELETE';
      const productId = data?.product_id as string | null;
      const product = productId ? lookup.products.get(productId) : null;
      const reasonId = data?.reason_id as string | null;
      const reason = reasonId ? lookup.reasons.get(reasonId) : null;
      const notes = data?.notes as string | null;

      return {
        type: 'event' as const,
        config,
        eventType,
        duration,
        isOngoing,
        product,
        reason,
        notes,
        startTs,
        endTs,
      };
    }
    if (log.entity_type === 'production_counts') {
      const good = (data?.good_qty as number) ?? 0;
      const reject = (data?.reject_qty as number) ?? 0;
      const notes = data?.notes as string | null;
      return { type: 'count' as const, good, reject, notes };
    }
    return { type: 'other' as const, entityLabel: ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type };
  }, [log, data, lookup]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 group rounded-lg px-2 py-2 -mx-2 transition-colors',
        editable && 'hover:bg-muted/50 cursor-pointer',
      )}
      onClick={() => editable && onEdit(log)}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        {description.type === 'event' && description.config ? (
          (() => {
            const Icon = description.config.icon;
            return (
              <div className={cn('h-8 w-8 rounded-full flex items-center justify-center border', description.config.bgClass)}>
                <Icon className={cn('h-4 w-4', description.config.colorClass)} />
              </div>
            );
          })()
        ) : (
          <div className="h-8 w-8 rounded-full flex items-center justify-center border bg-primary/10 border-primary/20">
            <Hash className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        {/* Row 1: Event type + action badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {description.type === 'event' && description.config && (
            <span className={cn('text-sm font-semibold', description.config.colorClass)}>
              {description.config.label}
            </span>
          )}
          {description.type === 'count' && (
            <span className="text-sm font-semibold text-primary">บันทึกจำนวน</span>
          )}
          {description.type === 'other' && (
            <span className="text-sm font-semibold">{description.entityLabel}</span>
          )}
          {getActionBadge(log.action)}
          {description.type === 'event' && description.isOngoing && (
            <Badge variant="outline" className="text-[10px] animate-pulse border-status-running/40 text-status-running px-1.5 py-0">
              กำลังดำเนินการ
            </Badge>
          )}

          {/* Edit/Delete buttons - always visible on mobile, hover on desktop */}
          {editable && (
            <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-auto" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(log)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(log)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Row 2: Time range — prominent display */}
        {description.type === 'event' && description.startTs && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{formatTimeLocal(description.startTs)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">
                {description.endTs ? formatTimeLocal(description.endTs) : '--:--:--'}
              </span>
            </div>
            {description.duration != null && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                {formatDuration(description.duration)}
              </Badge>
            )}
          </div>
        )}

        {/* Row 3: Extra details */}
        {description.type === 'event' && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {description.product && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {description.product.name}
              </span>
            )}
            {description.reason && (
              <span className="flex items-center gap-1">
                📋 {description.reason.name}
              </span>
            )}
            {description.notes && <span className="italic">📝 {description.notes}</span>}
          </div>
        )}

        {description.type === 'count' && (
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-status-running/10 text-status-running border-status-running/20 text-[10px] px-1.5 py-0">
              ✓ {(description as any).good}
            </Badge>
            {(description as any).reject > 0 && (
              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">
                ✗ {(description as any).reject}
              </Badge>
            )}
            {(description as any).notes && (
              <span className="text-xs text-muted-foreground italic">📝 {(description as any).notes}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Session Card ---
interface ActivitySessionCardProps {
  session: ActivitySession;
  showActor: boolean;
  lookup: LookupData;
  canEditFn: (log: AuditLog) => boolean;
  onEdit: (log: AuditLog) => void;
  onDelete: (log: AuditLog) => void;
}

export function ActivitySessionCard({
  session, showActor, lookup, canEditFn, onEdit, onDelete,
}: ActivitySessionCardProps) {
  const isSingleEntry = session.logs.length === 1;
  const [isExpanded, setIsExpanded] = useState(!isSingleEntry);

  const machine = session.machineId ? lookup.machines.get(session.machineId) : null;
  const sessionDuration = differenceInSeconds(new Date(session.endTs), new Date(session.startTs));

  // For single non-machine entries, render simpler
  if (isSingleEntry && !machine) {
    const log = session.logs[0];
    return (
      <div className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
        <SessionLogEntry
          log={log}
          lookup={lookup}
          editable={canEditFn(log)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    );
  }

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
        <div className="px-4 pt-3 pb-1 border-t border-border/50">
          {session.logs.map((log) => (
            <SessionLogEntry
              key={log.id}
              log={log}
              lookup={lookup}
              editable={canEditFn(log)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
