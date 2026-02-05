import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Play, Pause, AlertTriangle } from 'lucide-react';

interface MachineStatusCardProps {
  name: string;
  code: string;
  status: 'running' | 'idle' | 'stopped' | 'maintenance';
  oee: number;
  currentProduct?: string;
  compact?: boolean;
  onClick?: () => void;
}

const statusConfig = {
  running: {
    label: 'Running',
    icon: Play,
    bgClass: 'bg-status-running/10',
    textClass: 'text-status-running',
    borderClass: 'border-l-status-running',
    dotClass: 'bg-status-running',
  },
  idle: {
    label: 'Idle',
    icon: Pause,
    bgClass: 'bg-status-idle/10',
    textClass: 'text-status-idle',
    borderClass: 'border-l-status-idle',
    dotClass: 'bg-status-idle',
  },
  stopped: {
    label: 'Stopped',
    icon: AlertTriangle,
    bgClass: 'bg-status-stopped/10',
    textClass: 'text-status-stopped',
    borderClass: 'border-l-status-stopped',
    dotClass: 'bg-status-stopped',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    bgClass: 'bg-status-maintenance/10',
    textClass: 'text-status-maintenance',
    borderClass: 'border-l-status-maintenance',
    dotClass: 'bg-status-maintenance',
  },
};

export function MachineStatusCard({ 
  name, 
  code, 
  status, 
  oee, 
  currentProduct,
  compact = false,
  onClick,
}: MachineStatusCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-lg border-l-4 bg-muted/30 p-3 transition-colors hover:bg-muted/50 cursor-pointer',
        config.borderClass,
        onClick && 'hover:shadow-sm active:scale-[0.99]'
      )}
        onClick={onClick}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.bgClass)}>
            <StatusIcon className={cn('h-4 w-4', config.textClass)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">{code}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn(
            'text-lg font-bold',
            oee >= 85 ? 'text-status-running' :
            oee >= 60 ? 'text-status-idle' : 'text-status-stopped'
          )}>
            {oee.toFixed(1)}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      'relative overflow-hidden border-l-4 transition-all hover:shadow-md cursor-pointer',
      config.borderClass,
      onClick && 'active:scale-[0.99]'
    )}
    onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate">{name}</h3>
            <p className="text-xs text-muted-foreground">{code}</p>
          </div>
          <Badge 
            variant="secondary" 
            className={cn(
              'shrink-0 border-0 font-medium text-xs',
              config.bgClass, 
              config.textClass
            )}
          >
            <div className={cn('h-1.5 w-1.5 rounded-full mr-1.5', config.dotClass, status === 'running' && 'animate-pulse')} />
            {config.label}
          </Badge>
        </div>
        
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current OEE</p>
            <p className={cn(
              'text-2xl sm:text-3xl font-bold',
              oee >= 85 ? 'text-status-running' :
              oee >= 60 ? 'text-status-idle' : 'text-status-stopped'
            )}>
              {oee.toFixed(1)}%
            </p>
          </div>
          {currentProduct && (
            <div className="text-right min-w-0">
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="text-sm font-medium truncate">{currentProduct}</p>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={cn(
              'h-full transition-all duration-500',
              oee >= 85 ? 'bg-status-running' :
              oee >= 60 ? 'bg-status-idle' : 'bg-status-stopped'
            )}
            style={{ width: `${Math.min(oee, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
