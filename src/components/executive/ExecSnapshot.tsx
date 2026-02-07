import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecMetrics } from '@/hooks/useExecutiveData';

function getStatus(value: number): { label: string; dotClass: string } {
  if (value >= 85) return { label: 'Good', dotClass: 'bg-status-running' };
  if (value >= 60) return { label: 'Warning', dotClass: 'bg-status-idle' };
  return { label: 'Critical', dotClass: 'bg-status-stopped' };
}

interface KPICardProps {
  label: string;
  value: number;
  delta?: number;
  today?: number;
  target?: number;
  accentClass: string;
}

function KPICard({ label, value, delta, today, target, accentClass }: KPICardProps) {
  const status = getStatus(value);
  const DeltaIcon = delta !== undefined && delta > 0 ? TrendingUp : delta !== undefined && delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta !== undefined && delta > 0
    ? 'text-status-running'
    : delta !== undefined && delta < 0
      ? 'text-status-stopped'
      : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card relative overflow-hidden shadow-sm">
      <div className={cn('absolute top-0 left-0 w-full h-1', accentClass)} />
      <div className="flex flex-col items-center gap-1 px-3 pt-4 pb-3">
        <span className="text-3xl xl:text-4xl font-bold tabular-nums tracking-tight text-card-foreground">
          {value.toFixed(1)}%
        </span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>

        {delta !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', deltaColor)}>
            <DeltaIcon className="h-3 w-3" />
            <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs prev</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={cn('h-2 w-2 rounded-full', status.dotClass)} />
          <span className="text-[10px] font-medium text-muted-foreground">{status.label}</span>
        </div>

        {(today !== undefined || target !== undefined) && (
          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground tabular-nums">
            {today !== undefined && <span>Today: {today.toFixed(1)}%</span>}
            {target !== undefined && target > 0 && <span>Target: {target.toFixed(0)}%</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function KPISkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2 w-12" />
      </div>
    </div>
  );
}

interface ExecSnapshotProps {
  summary: ExecMetrics | null;
  previous: ExecMetrics | null;
  today: ExecMetrics | null;
  targets: ExecMetrics | null;
  isLoading: boolean;
}

export function ExecSnapshot({ summary, previous, today, targets, isLoading }: ExecSnapshotProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    );
  }

  const s = summary || { oee: 0, availability: 0, performance: 0, quality: 0 };

  const cards: KPICardProps[] = [
    {
      label: 'Overall OEE',
      value: s.oee,
      delta: previous ? s.oee - previous.oee : undefined,
      today: today?.oee,
      target: targets?.oee,
      accentClass: 'bg-oee-overall',
    },
    {
      label: 'Availability',
      value: s.availability,
      delta: previous ? s.availability - previous.availability : undefined,
      today: today?.availability,
      target: targets?.availability,
      accentClass: 'bg-oee-availability',
    },
    {
      label: 'Performance',
      value: s.performance,
      delta: previous ? s.performance - previous.performance : undefined,
      today: today?.performance,
      target: targets?.performance,
      accentClass: 'bg-oee-performance',
    },
    {
      label: 'Quality',
      value: s.quality,
      delta: previous ? s.quality - previous.quality : undefined,
      today: today?.quality,
      target: targets?.quality,
      accentClass: 'bg-oee-quality',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => <KPICard key={c.label} {...c} />)}
    </div>
  );
}
