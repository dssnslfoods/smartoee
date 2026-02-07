import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, AlertTriangle, Wrench, Clock, User, Package } from 'lucide-react';
import type { MonitorMachine } from '@/hooks/useMonitorData';

const statusConfig = {
  running: {
    label: 'Running',
    icon: Play,
    bgClass: 'bg-status-running/10',
    textClass: 'text-status-running',
    borderClass: 'border-status-running',
    dotClass: 'bg-status-running',
    glowClass: 'shadow-[0_0_20px_-5px_hsl(var(--status-running)/0.4)]',
  },
  idle: {
    label: 'Idle',
    icon: Pause,
    bgClass: 'bg-status-idle/10',
    textClass: 'text-status-idle',
    borderClass: 'border-status-idle',
    dotClass: 'bg-status-idle',
    glowClass: '',
  },
  stopped: {
    label: 'Stopped',
    icon: AlertTriangle,
    bgClass: 'bg-status-stopped/10',
    textClass: 'text-status-stopped',
    borderClass: 'border-status-stopped',
    dotClass: 'bg-status-stopped',
    glowClass: 'shadow-[0_0_20px_-5px_hsl(var(--status-stopped)/0.4)]',
  },
  maintenance: {
    label: 'Setup',
    icon: Wrench,
    bgClass: 'bg-status-maintenance/10',
    textClass: 'text-status-maintenance',
    borderClass: 'border-status-maintenance',
    dotClass: 'bg-status-maintenance',
    glowClass: 'shadow-[0_0_20px_-5px_hsl(var(--status-maintenance)/0.4)]',
  },
};

function formatElapsed(startTs: string): string {
  const seconds = Math.floor((Date.now() - new Date(startTs).getTime()) / 1000);
  if (seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

interface MonitorMachineCardProps {
  machine: MonitorMachine;
}

export function MonitorMachineCard({ machine }: MonitorMachineCardProps) {
  const config = statusConfig[machine.status];
  const StatusIcon = config.icon;
  const [elapsed, setElapsed] = useState(machine.startTs ? formatElapsed(machine.startTs) : '');

  // Live timer
  useEffect(() => {
    if (!machine.startTs) {
      setElapsed('');
      return;
    }
    setElapsed(formatElapsed(machine.startTs));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(machine.startTs!));
    }, 1000);
    return () => clearInterval(interval);
  }, [machine.startTs]);

  return (
    <Card className={cn(
      'relative overflow-hidden border-l-4 transition-all',
      config.borderClass,
      config.glowClass,
      machine.status === 'running' && 'hover:shadow-[0_0_30px_-5px_hsl(var(--status-running)/0.5)]',
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{machine.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{machine.code}</p>
          </div>
          <Badge
            variant="secondary"
            className={cn('shrink-0 border-0 font-medium text-xs', config.bgClass, config.textClass)}
          >
            <div className={cn(
              'h-1.5 w-1.5 rounded-full mr-1.5',
              config.dotClass,
              machine.status === 'running' && 'animate-pulse',
            )} />
            {config.label}
          </Badge>
        </div>

        {/* Duration timer */}
        {machine.startTs && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-mono font-bold',
              config.bgClass,
              config.textClass,
            )}>
              <Clock className="h-3.5 w-3.5" />
              {elapsed}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {/* Line / Plant */}
          {machine.line_name && (
            <p className="truncate">
              {machine.line_name}
              {machine.plant_name && ` • ${machine.plant_name}`}
            </p>
          )}

          {/* Product */}
          {machine.productName && (
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 shrink-0" />
              <span className="truncate">{machine.productName}</span>
              {machine.productCode && (
                <span className="font-mono text-[10px]">({machine.productCode})</span>
              )}
            </div>
          )}

          {/* Downtime reason */}
          {machine.reasonName && (
            <p className="truncate text-status-stopped">
              📋 {machine.reasonName}
            </p>
          )}

          {/* Operator */}
          {machine.operatorName && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{machine.operatorName}</span>
            </div>
          )}

          {/* Notes */}
          {machine.notes && (
            <p className="italic truncate">📝 {machine.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
