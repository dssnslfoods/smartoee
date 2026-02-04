import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineSkeleton } from '@/components/ui/skeletons';
import { Play, Pause, Wrench, Clock, Timer } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ProductionEvent } from '@/services/types';

interface EventTimelineProps {
  events: ProductionEvent[];
  isLoading?: boolean;
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

export function EventTimeline({ events, isLoading = false }: EventTimelineProps) {
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
          {events.map((event, index) => {
            const config = eventTypeConfig[event.event_type];
            const Icon = config.icon;
            const startTime = new Date(event.start_ts);
            const endTime = event.end_ts ? new Date(event.end_ts) : null;
            const duration = endTime 
              ? differenceInMinutes(endTime, startTime)
              : differenceInMinutes(new Date(), startTime);
            const isOngoing = !event.end_ts;

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
                  config.borderColor
                )}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={isOngoing ? 'default' : 'secondary'}>
                        {config.label}
                      </Badge>
                      {isOngoing && (
                        <Badge variant="outline" className="animate-pulse">
                          กำลังดำเนินการ
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
