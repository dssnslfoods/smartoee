import { useQuery } from '@tanstack/react-query';
import { Loader2, Check, X, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProductionCounts } from '@/services';
import type { ProductionCount } from '@/services/types';

interface ProductionCountHistoryProps {
  machineId: string;
  shiftCalendarId?: string;
}

export function ProductionCountHistory({ machineId, shiftCalendarId }: ProductionCountHistoryProps) {
  const { data: counts = [], isLoading } = useQuery({
    queryKey: ['productionCounts', machineId, shiftCalendarId],
    queryFn: () => getProductionCounts(machineId, shiftCalendarId),
    enabled: !!machineId,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (counts.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">ยังไม่มีการบันทึกจำนวนผลิตในกะนี้</p>
      </div>
    );
  }

  // Calculate totals
  const totalGood = counts.reduce((sum, c) => sum + (c.good_qty || 0), 0);
  const totalReject = counts.reduce((sum, c) => sum + (c.reject_qty || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          รวมกะนี้ ({counts.length} ครั้ง)
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-semibold text-green-500">
            <Check className="h-3.5 w-3.5" />
            {totalGood.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-red-500">
            <X className="h-3.5 w-3.5" />
            {totalReject.toLocaleString()}
          </span>
          <span className="text-sm font-bold tabular-nums">
            = {(totalGood + totalReject).toLocaleString()} ชิ้น
          </span>
        </div>
      </div>

      {/* Count entries */}
      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
        {counts.map((count, index) => (
          <CountEntry key={count.id} count={count} isLatest={index === 0} />
        ))}
      </div>
    </div>
  );
}

function CountEntry({ count, isLatest }: { count: ProductionCount; isLatest: boolean }) {
  const time = new Date(count.ts).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const total = (count.good_qty || 0) + (count.reject_qty || 0);

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        isLatest
          ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-mono text-muted-foreground">{time}</span>
          {isLatest && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              ล่าสุด
            </span>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()} ชิ้น</span>
      </div>

      <div className="flex items-center gap-4 mt-1.5">
        <span className="flex items-center gap-1 text-sm">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="text-green-500 font-medium tabular-nums">{(count.good_qty || 0).toLocaleString()}</span>
        </span>
        {(count.reject_qty || 0) > 0 && (
          <span className="flex items-center gap-1 text-sm">
            <X className="h-3.5 w-3.5 text-red-500" />
            <span className="text-red-500 font-medium tabular-nums">{(count.reject_qty || 0).toLocaleString()}</span>
            {count.defect_reason && (
              <span className="text-xs text-muted-foreground ml-1">
                ({(count.defect_reason as any).name})
              </span>
            )}
          </span>
        )}
      </div>

      {count.notes && (
        <p className="text-xs text-muted-foreground mt-1.5 italic">📝 {count.notes}</p>
      )}
    </div>
  );
}
