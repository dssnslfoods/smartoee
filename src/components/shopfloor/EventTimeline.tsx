import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineSkeleton } from '@/components/ui/skeletons';
import { Play, Pause, Wrench, Clock, Timer, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ProductionEvent, ProductionStandard } from '@/services/types';

interface EventTimelineProps {
  events: ProductionEvent[];
  isLoading?: boolean;
  /** Map of product_id -> ProductionStandard for the current machine */
  standardsMap?: Map<string, ProductionStandard>;
  /** Current machine's default cycle time */
  machineCycleTime?: number;
  /** Total good + reject counts for the shift (for performance calc) */
  totalOutput?: number;
}

const eventTypeConfig = {
  RUN: {
    color: 'bg-status-running',
    bgColor: 'bg-status-running/5',
    borderColor: 'border-status-running/20',
    icon: Play,
    label: 'Running'
  },
  DOWNTIME: {
    color: 'bg-status-stopped',
    bgColor: 'bg-status-stopped/5',
    borderColor: 'border-status-stopped/20',
    icon: Pause,
    label: 'Downtime'
  },
  SETUP: {
    color: 'bg-status-idle',
    bgColor: 'bg-status-idle/5',
    borderColor: 'border-status-idle/20',
    icon: Wrench,
    label: 'Setup'
  },
};

export function EventTimeline({
  events,
  isLoading = false,
  standardsMap,
  machineCycleTime,
}: EventTimelineProps) {
  if (isLoading) {
    return <TimelineSkeleton items={4} />;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">ยังไม่มีเหตุการณ์ในกะนี้</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {events.map((event) => {
            const config = eventTypeConfig[event.event_type];
            const Icon = config.icon;
            const startTime = new Date(event.start_ts);
            const endTime = event.end_ts ? new Date(event.end_ts) : null;
            const duration = endTime
              ? differenceInMinutes(endTime, startTime)
              : differenceInMinutes(new Date(), startTime);
            const isOngoing = !event.end_ts;
            const hasProduct = event.event_type === 'RUN' && event.product;

            // Check if performance is slow compared to benchmark
            let isSlowPerformance = false;
            let benchmarkCycleTime: number | undefined;
            if (event.event_type === 'RUN' && event.product_id) {
              const standard = standardsMap?.get(event.product_id);
              benchmarkCycleTime = standard?.ideal_cycle_time_seconds ?? machineCycleTime;

              // Calculate actual cycle time: duration / expected output
              if (benchmarkCycleTime && duration > 0) {
                const durationSeconds = endTime
                  ? differenceInSeconds(endTime, startTime)
                  : differenceInSeconds(new Date(), startTime);
                // Expected output at benchmark speed
                const expectedOutput = durationSeconds / benchmarkCycleTime;
                // If we have less than 80% of expected output, flag as slow
                // Simple heuristic: if the event has been running longer than the setup time without output
                if (durationSeconds > 120 && expectedOutput > 0) {
                  // We mark slow if duration exceeds expected significantly
                  isSlowPerformance = durationSeconds > (benchmarkCycleTime * expectedOutput * 1.25);
                }
              }
            }

            // For RUN events without a benchmark standard, mark as warning
            const noBenchmark = event.event_type === 'RUN' && event.product_id &&
              !standardsMap?.has(event.product_id);

            return (
              <div key={event.id} className="relative flex items-center gap-4 py-3 group">
                {/* Timeline dot/icon */}
                <div className={cn(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 shadow-sm',
                  config.color,
                  isOngoing && 'ring-4 ring-offset-2 animate-pulse'
                )}>
                  <Icon className="h-4 w-4 text-white" />
                </div>

                {/* Content - Horizontal Layout */}
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  {/* Status Label */}
                  <div className={cn(
                    'w-20 font-semibold',
                    event.event_type === 'RUN' ? 'text-status-running' :
                      event.event_type === 'DOWNTIME' ? 'text-status-stopped' :
                        'text-status-idle'
                  )}>
                    {config.label}
                  </div>

                  {/* Time Range */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-28 shrink-0">
                    <span className="font-mono">
                      {format(startTime, 'HH:mm')} - {endTime ? format(endTime, 'HH:mm') : 'Present'}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground w-16 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{duration}m</span>
                  </div>

                  {/* Product or Reason Badge */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {event.event_type === 'RUN' ? (
                      <div className="flex items-center gap-2 truncate">
                        {event.product ? (
                          <Badge variant="secondary" className="bg-muted/50 text-muted-foreground hover:bg-muted font-normal rounded-full px-3 py-0.5 max-w-[150px] truncate">
                            {event.product.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No Product</span>
                        )}

                        {/* Alert Badges for Performance */}
                        {isSlowPerformance && (
                          <Badge className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 px-1.5 py-0">
                            Slow
                          </Badge>
                        )}
                        {noBenchmark && (
                          <Badge className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20 px-1.5 py-0">
                            No Std
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="truncate text-sm text-muted-foreground">
                        {event.reason ? (
                          <span className="bg-muted/30 px-2 py-0.5 rounded text-xs">
                            {event.reason.name}
                          </span>
                        ) : event.notes ? (
                          <span className="italic">"{event.notes}"</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Hidden Benchmarks shown on hover or optionally below if needed */}
                  {benchmarkCycleTime && (
                    <div className="text-[10px] text-muted-foreground/60 shrink-0 hidden md:block">
                      {(60 / benchmarkCycleTime).toFixed(1)}/m
                    </div>
                  )}
                </div>

                {/* Sub-info for Benchmarks (Optional: Shown below if benchmarks exist) */}
                {benchmarkCycleTime && (isSlowPerformance || noBenchmark) && (
                  <div className="absolute left-10 top-10 text-[9px] text-muted-foreground">
                    Benchmark: {(60 / benchmarkCycleTime).toFixed(1)} pcs/min
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
