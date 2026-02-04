import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Play, Pause, AlertTriangle } from 'lucide-react';

interface MachineStatusCardProps {
  name: string;
  code: string;
  status: 'running' | 'idle' | 'stopped' | 'maintenance';
  oee: number;
  currentProduct?: string;
}

const statusConfig = {
  running: {
    label: 'Running',
    icon: Play,
    bgClass: 'bg-status-running/10',
    textClass: 'text-status-running',
    borderClass: 'border-status-running/30',
  },
  idle: {
    label: 'Idle',
    icon: Pause,
    bgClass: 'bg-status-idle/10',
    textClass: 'text-status-idle',
    borderClass: 'border-status-idle/30',
  },
  stopped: {
    label: 'Stopped',
    icon: AlertTriangle,
    bgClass: 'bg-status-stopped/10',
    textClass: 'text-status-stopped',
    borderClass: 'border-status-stopped/30',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    bgClass: 'bg-status-maintenance/10',
    textClass: 'text-status-maintenance',
    borderClass: 'border-status-maintenance/30',
  },
};

export function MachineStatusCard({ 
  name, 
  code, 
  status, 
  oee, 
  currentProduct 
}: MachineStatusCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn('border-l-4 transition-all hover:shadow-md', config.borderClass)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{name}</CardTitle>
            <p className="text-xs text-muted-foreground">{code}</p>
          </div>
          <Badge 
            variant="secondary" 
            className={cn(config.bgClass, config.textClass, 'border-0')}
          >
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current OEE</p>
            <p className={cn(
              'text-2xl font-bold',
              oee >= 85 ? 'text-oee-availability' :
              oee >= 60 ? 'text-oee-performance' : 'text-destructive'
            )}>
              {oee.toFixed(1)}%
            </p>
          </div>
          {currentProduct && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="text-sm font-medium">{currentProduct}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
