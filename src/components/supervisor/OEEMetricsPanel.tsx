import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OEEMetricsPanelProps {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  runTime: number | null;
  downtime: number | null;
  goodQty: number | null;
  rejectQty: number | null;
}

export function OEEMetricsPanel({
  availability,
  performance,
  quality,
  oee,
  runTime,
  downtime,
  goodQty,
  rejectQty,
}: OEEMetricsPanelProps) {
  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(1)}%`;
  };

  const getColorClass = (value: number | null) => {
    if (value === null || value === undefined) return 'text-muted-foreground';
    if (value >= 85) return 'text-status-running';
    if (value >= 60) return 'text-status-idle';
    return 'text-status-stopped';
  };

  const getProgressColor = (value: number | null) => {
    if (value === null || value === undefined) return 'bg-muted';
    if (value >= 85) return 'bg-status-running';
    if (value >= 60) return 'bg-status-idle';
    return 'bg-status-stopped';
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'availability': return 'border-l-oee-availability';
      case 'performance': return 'border-l-oee-performance';
      case 'quality': return 'border-l-oee-quality';
      case 'oee': return 'border-l-oee-overall';
      default: return '';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* OEE Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Availability"
          value={availability}
          type="availability"
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
          getBorderColor={getBorderColor}
        />
        <MetricCard
          label="Performance"
          value={performance}
          type="performance"
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
          getBorderColor={getBorderColor}
        />
        <MetricCard
          label="Quality"
          value={quality}
          type="quality"
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
          getBorderColor={getBorderColor}
        />
        <MetricCard
          label="OEE"
          value={oee}
          type="oee"
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
          getBorderColor={getBorderColor}
          isMain
        />
      </div>

      {/* Production Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Run Time" value={runTime} unit="นาที" />
        <StatCard label="Downtime" value={downtime} unit="นาที" variant="warning" />
        <StatCard label="Good Qty" value={goodQty} unit="ชิ้น" variant="success" />
        <StatCard label="Reject Qty" value={rejectQty} unit="ชิ้น" variant="danger" />
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number | null;
  type: string;
  formatPercent: (value: number | null) => string;
  getColorClass: (value: number | null) => string;
  getProgressColor: (value: number | null) => string;
  getBorderColor: (type: string) => string;
  isMain?: boolean;
}

function MetricCard({
  label,
  value,
  type,
  formatPercent,
  getColorClass,
  getProgressColor,
  getBorderColor,
  isMain,
}: MetricCardProps) {
  const progressColor = getProgressColor(value);
  
  return (
    <Card className={cn(
      'relative overflow-hidden border-l-4 transition-all',
      getBorderColor(type),
      isMain && 'ring-2 ring-primary/20 bg-gradient-to-br from-card to-accent/20'
    )}>
      <CardContent className="p-3 sm:p-4">
        <div className="text-xs sm:text-sm text-muted-foreground mb-1 font-medium">{label}</div>
        <div className={cn('text-xl sm:text-2xl font-bold', getColorClass(value))}>
          {formatPercent(value)}
        </div>
        <div className="h-1.5 mt-3 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn('h-full transition-all duration-500', progressColor)}
            style={{ width: `${Math.min(value ?? 0, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: number | null;
  unit: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function StatCard({ label, value, unit, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: '',
    success: 'text-status-running',
    warning: 'text-status-idle',
    danger: 'text-status-stopped',
  };

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="text-xs sm:text-sm text-muted-foreground mb-1 font-medium">{label}</div>
        <div className={cn('text-lg sm:text-xl font-semibold', variantClasses[variant])}>
          {value ?? 0}{' '}
          <span className="text-xs sm:text-sm font-normal text-muted-foreground">{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}
