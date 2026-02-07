import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecParetoItem } from '@/hooks/useExecutiveData';

interface ExecLossParetoProps {
  data: ExecParetoItem[];
  isLoading: boolean;
  className?: string;
}

export function ExecLossPareto({ data, isLoading, className }: ExecLossParetoProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Top Losses by Impact
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0;
  const maxMinutes = hasData ? data[0].minutes : 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Top Losses by Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No downtime data available
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.map((item, idx) => (
              <div key={item.reason} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-card-foreground truncate">
                      {item.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums font-semibold text-card-foreground">
                      {item.minutes} min
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-status-stopped/80 transition-all duration-500"
                    style={{ width: `${maxMinutes > 0 ? (item.minutes / maxMinutes) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
