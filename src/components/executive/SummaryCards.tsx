import { Card, CardContent } from '@/components/ui/card';
import { OEEGauge } from '@/components/dashboard/OEEGauge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OEEMetrics {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

interface SummaryCardsProps {
  current: OEEMetrics;
  previous?: OEEMetrics;
  isLoading?: boolean;
}

function TrendIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  
  const diff = current - previous;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const colorClass = diff > 0 ? 'text-status-running' : diff < 0 ? 'text-status-stopped' : 'text-muted-foreground';
  
  return (
    <div className={cn('flex items-center gap-1 text-xs', colorClass)}>
      <Icon className="h-3 w-3" />
      <span>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>
    </div>
  );
}

function SummaryCardSkeleton({ borderColor }: { borderColor: string }) {
  return (
    <Card className={cn('border-l-4', borderColor)}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ current, previous, isLoading }: SummaryCardsProps) {
  const metrics = [
    { key: 'availability', label: 'Availability', color: 'availability' as const, borderColor: 'border-l-oee-availability' },
    { key: 'performance', label: 'Performance', color: 'performance' as const, borderColor: 'border-l-oee-performance' },
    { key: 'quality', label: 'Quality', color: 'quality' as const, borderColor: 'border-l-oee-quality' },
    { key: 'oee', label: 'Overall OEE', color: 'overall' as const, borderColor: 'border-l-oee-overall' },
  ] as const;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <SummaryCardSkeleton key={m.key} borderColor={m.borderColor} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.key} className={cn('border-l-4', m.borderColor, m.key === 'oee' && 'bg-gradient-to-br from-card to-accent/20')}>
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <OEEGauge
                value={current[m.key] ?? 0}
                label=""
                color={m.color}
                size="md"
              />
              <p className="mt-2 font-medium text-muted-foreground">{m.label}</p>
              <TrendIndicator
                current={current[m.key] ?? 0}
                previous={previous?.[m.key]}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
