import { Card, CardContent } from '@/components/ui/card';

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
    if (value >= 85) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (value: number | null) => {
    if (value === null || value === undefined) return 'bg-muted';
    if (value >= 85) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {/* OEE Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Availability"
          value={availability}
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
        />
        <MetricCard
          label="Performance"
          value={performance}
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
        />
        <MetricCard
          label="Quality"
          value={quality}
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
        />
        <MetricCard
          label="OEE"
          value={oee}
          formatPercent={formatPercent}
          getColorClass={getColorClass}
          getProgressColor={getProgressColor}
          isMain
        />
      </div>

      {/* Production Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Run Time" value={runTime} unit="นาที" />
        <StatCard label="Downtime" value={downtime} unit="นาที" />
        <StatCard label="Good Qty" value={goodQty} unit="ชิ้น" highlight="green" />
        <StatCard label="Reject Qty" value={rejectQty} unit="ชิ้น" highlight="red" />
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number | null;
  formatPercent: (value: number | null) => string;
  getColorClass: (value: number | null) => string;
  getProgressColor: (value: number | null) => string;
  isMain?: boolean;
}

function MetricCard({
  label,
  value,
  formatPercent,
  getColorClass,
  getProgressColor,
  isMain,
}: MetricCardProps) {
  const progressColor = getProgressColor(value);
  
  return (
    <Card className={isMain ? 'border-primary' : ''}>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-bold ${getColorClass(value)}`}>
          {formatPercent(value)}
        </div>
        <div className="h-2 mt-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all ${progressColor}`}
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
  highlight?: 'green' | 'red';
}

function StatCard({ label, value, unit, highlight }: StatCardProps) {
  const highlightClass = highlight === 'green'
    ? 'text-green-600'
    : highlight === 'red'
    ? 'text-red-600'
    : '';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground mb-1">{label}</div>
        <div className={`text-xl font-semibold ${highlightClass}`}>
          {value ?? 0} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}
