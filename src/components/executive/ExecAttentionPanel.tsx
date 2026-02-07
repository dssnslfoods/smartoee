import { TrendingDown, AlertTriangle, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecAttentionItem } from '@/hooks/useExecutiveData';

const typeIcons = {
  declining: TrendingDown,
  low_availability: AlertTriangle,
  repeating_loss: Repeat,
};

interface ExecAttentionPanelProps {
  items: ExecAttentionItem[];
  isLoading: boolean;
  className?: string;
}

export function ExecAttentionPanel({ items, isLoading, className }: ExecAttentionPanelProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Attention Required
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = items.filter(i => i.severity === 'critical').length;
  const warningCount = items.filter(i => i.severity === 'warning').length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Attention Required
        </CardTitle>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-status-stopped/15 text-status-stopped">
                {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-status-idle/15 text-status-idle">
                {warningCount}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {items.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
            <div className="h-8 w-8 rounded-full bg-status-running/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-status-running" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span>No issues detected</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, idx) => {
              const Icon = typeIcons[item.type];
              const isCritical = item.severity === 'critical';

              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs',
                    isCritical ? 'bg-status-stopped/8' : 'bg-status-idle/8'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 shrink-0',
                    isCritical ? 'text-status-stopped' : 'text-status-idle'
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-card-foreground leading-tight truncate">
                      {item.title}
                    </p>
                    <p className="text-muted-foreground text-[10px] leading-tight mt-0.5">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
