import { Timer, Wrench, ShieldCheck, Gauge, AlertTriangle, Cpu, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { resolveTimeUnit, fromSeconds, TIME_UNIT_SHORT, toOutputRate } from '@/lib/timeUnitUtils';
import type { ProductionStandard } from '@/services/types';

interface ProductionBenchmarkCardProps {
  productionStandard: ProductionStandard | null | undefined;
  machineName?: string;
  machineCode?: string;
  machineCycleTime?: number;
  machineTimeUnit?: string;
  productName?: string;
  productCode?: string;
  noBenchmarkWarning?: string | null;
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  colorClass: string;
  bgClass: string;
}

function MetricItem({ icon, label, value, unit, colorClass, bgClass }: MetricItemProps) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
      bgClass
    )}>
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        colorClass
      )}>
        {icon}
      </div>
      <p className="text-xs font-medium text-muted-foreground text-center leading-tight">{label}</p>
      <div className="text-center">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        <span className="text-xs text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}

export function ProductionBenchmarkCard({
  productionStandard,
  machineName,
  machineCode,
  machineCycleTime,
  machineTimeUnit,
  productName,
  productCode,
  noBenchmarkWarning,
}: ProductionBenchmarkCardProps) {
  const hasBenchmark = !!productionStandard;
  const unit = resolveTimeUnit(machineTimeUnit);
  const unitLabel = TIME_UNIT_SHORT[unit];

  const cycleTime = productionStandard?.ideal_cycle_time_seconds ?? machineCycleTime;
  const setupTime = productionStandard?.std_setup_time_seconds ?? 0;
  const targetQuality = productionStandard?.target_quality ?? 99;

  return (
    <div className="space-y-3">
      {/* Header: Machine × SKU pair */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5 text-xs font-medium py-1 px-2.5">
          <Cpu className="h-3 w-3" />
          {machineName || machineCode || '—'}
        </Badge>
        <span className="text-muted-foreground text-xs">×</span>
        <Badge variant="outline" className="gap-1.5 text-xs font-medium py-1 px-2.5">
          <Package className="h-3 w-3" />
          {productName || productCode || '—'}
        </Badge>
        {hasBenchmark ? (
          <Badge className="bg-status-running/15 text-status-running border-status-running/30 text-xs gap-1">
            <ShieldCheck className="h-3 w-3" />
            Benchmark Set
          </Badge>
        ) : (
          <Badge className="bg-warning/15 text-warning border-warning/30 text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Machine Default
          </Badge>
        )}
      </div>

      {/* Benchmark Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <MetricItem
          icon={<Timer className="h-5 w-5 text-primary" />}
          label="Output Rate"
          value={cycleTime != null && cycleTime > 0 ? toOutputRate(cycleTime).toFixed(1) : '—'}
          unit="ชิ้น/นาที"
          colorClass="bg-primary/10"
          bgClass="border-primary/20 bg-primary/5"
        />
        <MetricItem
          icon={<Wrench className="h-5 w-5 text-oee-performance" />}
          label="Setup Time"
          value={setupTime != null ? fromSeconds(setupTime, unit).toFixed(unit === 'minutes' ? 2 : 1) : '—'}
          unit={unitLabel}
          colorClass="bg-oee-performance/10"
          bgClass="border-oee-performance/20 bg-oee-performance/5"
        />
        <MetricItem
          icon={<Gauge className="h-5 w-5 text-oee-quality" />}
          label="Target Quality"
          value={targetQuality?.toFixed(1) ?? '—'}
          unit="%"
          colorClass="bg-oee-quality/10"
          bgClass="border-oee-quality/20 bg-oee-quality/5"
        />
      </div>

      {/* Warning if no benchmark */}
      {noBenchmarkWarning && (
        <Alert className="py-2 border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs text-warning">
            {noBenchmarkWarning} — ใช้ค่า Machine Default แทน
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
