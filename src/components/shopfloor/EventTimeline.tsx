import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineSkeleton } from '@/components/ui/skeletons';
import { Play, Pause, Wrench, Clock, Timer, Package, AlertTriangle } from 'lucide-react';
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
              <div key={event.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className={cn(
                  'relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0',
                  config.color,
                  isOngoing && 'ring-4 ring-offset-2 animate-pulse'
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>

                {/* Content */}
                <div className={cn(
                  'flex-1 rounded-lg border p-3',
                  config.bgColor,
                  noBenchmark 
                    ? 'border-yellow-500 border-2'
                    : isSlowPerformance
                      ? 'border-orange-500 border-2'
                      : config.borderColor
                )}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={isOngoing ? 'default' : 'secondary'}>
                        {config.label}
                      </Badge>
                      {hasProduct && (
                        <Badge variant="outline" className="text-xs gap-1 bg-background/50">
                          <Package className="h-3 w-3" />
                          {event.product!.name}
                        </Badge>
                      )}
                      {isOngoing && (
                        <Badge variant="outline" className="animate-pulse">
                          กำลังดำเนินการ
                        </Badge>
                      )}
                      {isSlowPerformance && (
                        <Badge className="text-xs gap-1 bg-orange-500/20 text-orange-700 border-orange-500/30">
                          <AlertTriangle className="h-3 w-3" />
                          Slow Performance
                        </Badge>
                      )}
                      {noBenchmark && (
                        <Badge className="text-xs gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                          <AlertTriangle className="h-3 w-3" />
                          No Benchmark
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Timer className="h-3 w-3" />
                      <span>{duration} นาที</span>
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {format(startTime, 'HH:mm', { locale: th })}
                        {endTime && (
                          <> - {format(endTime, 'HH:mm', { locale: th })}</>
                        )}
                      </span>
                      {benchmarkCycleTime && (
                        <span className="text-xs">
                          • Benchmark: {benchmarkCycleTime}s
                        </span>
                      )}
                    </div>
                    
                    {event.reason && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">สาเหตุ: </span>
                        {event.reason.name}
                      </p>
                    )}
                    
                    {event.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        "{event.notes}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
