import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecLineRankItem } from '@/hooks/useExecutiveData';

function getOeeColor(value: number): string {
  if (value >= 85) return 'bg-status-running';
  if (value >= 60) return 'bg-status-idle';
  return 'bg-status-stopped';
}

function getOeeTextColor(value: number): string {
  if (value >= 85) return 'text-status-running';
  if (value >= 60) return 'text-status-idle';
  return 'text-status-stopped';
}

interface ExecLineRankingProps {
  data: ExecLineRankItem[];
  isLoading: boolean;
  className?: string;
}

export function ExecLineRanking({ data, isLoading, className }: ExecLineRankingProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Line Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Line Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {!hasData ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
            No line data available
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((line, idx) => (
              <div key={line.id} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground w-3 shrink-0 text-right">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium text-card-foreground w-20 shrink-0 truncate" title={line.name}>
                  {line.name}
                </span>
                <div className="flex-1 h-4 bg-muted rounded overflow-hidden relative">
                  <div
                    className={cn('h-full rounded transition-all duration-500', getOeeColor(line.oee))}
                    style={{ width: `${Math.min(line.oee, 100)}%`, opacity: 0.75 }}
                  />
                </div>
                <span className={cn(
                  'text-xs tabular-nums font-bold w-12 text-right shrink-0',
                  getOeeTextColor(line.oee)
                )}>
                  {line.oee.toFixed(1)}%
                </span>
              </div>
            ))}

            {/* Sub-metrics legend */}
            {data.length > 0 && (
              <div className="pt-2 border-t border-border mt-3">
                <div className="grid grid-cols-4 text-[10px] text-muted-foreground font-medium">
                  <span>Line</span>
                  <span className="text-center">A%</span>
                  <span className="text-center">P%</span>
                  <span className="text-center">Q%</span>
                </div>
                {data.slice(0, 5).map(line => (
                  <div key={line.id} className="grid grid-cols-4 text-[10px] tabular-nums py-0.5">
                    <span className="text-card-foreground truncate" title={line.name}>{line.name}</span>
                    <span className="text-center text-muted-foreground">{line.availability.toFixed(1)}</span>
                    <span className="text-center text-muted-foreground">{line.performance.toFixed(1)}</span>
                    <span className="text-center text-muted-foreground">{line.quality.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
