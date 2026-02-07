import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecLossCategoryItem } from '@/hooks/useExecutiveData';

const categoryConfig: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  PLANNED: { label: 'Planned', colorClass: 'text-muted-foreground', bgClass: 'bg-muted-foreground' },
  UNPLANNED: { label: 'Unplanned', colorClass: 'text-status-idle', bgClass: 'bg-status-idle' },
  BREAKDOWN: { label: 'Breakdown', colorClass: 'text-status-stopped', bgClass: 'bg-status-stopped' },
  CHANGEOVER: { label: 'Changeover', colorClass: 'text-primary', bgClass: 'bg-primary' },
  UNKNOWN: { label: 'Other', colorClass: 'text-muted-foreground', bgClass: 'bg-muted' },
};

interface ExecLossCategoryProps {
  data: ExecLossCategoryItem[];
  isLoading: boolean;
  className?: string;
}

export function ExecLossCategory({ data, isLoading, className }: ExecLossCategoryProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Loss Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Loss Categories
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
            No loss data available
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="h-5 rounded-full overflow-hidden flex">
              {data.map(item => {
                const config = categoryConfig[item.category] || categoryConfig.UNKNOWN;
                return (
                  <div
                    key={item.category}
                    className={cn('h-full transition-all duration-500', config.bgClass)}
                    style={{ width: `${item.percentage}%`, opacity: 0.8 }}
                    title={`${config.label}: ${item.minutes} min (${item.percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend with values */}
            <div className="space-y-1.5">
              {data.map(item => {
                const config = categoryConfig[item.category] || categoryConfig.UNKNOWN;
                return (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-sm', config.bgClass)} style={{ opacity: 0.8 }} />
                      <span className="text-xs font-medium text-card-foreground">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">{item.minutes} min</span>
                      <span className="text-xs tabular-nums font-semibold text-card-foreground w-10 text-right">
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground">Total Downtime</span>
              <span className="text-xs tabular-nums font-bold text-card-foreground">{totalMinutes} min</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
