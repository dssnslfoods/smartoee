import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { ShiftCalendar } from '@/services/types';

interface CurrentShiftBannerProps {
  shiftCalendar: ShiftCalendar;
  isLocked?: boolean;
}

export function CurrentShiftBanner({ shiftCalendar, isLocked = false }: CurrentShiftBannerProps) {
  const shift = shiftCalendar.shift;
  const shiftDate = new Date(shiftCalendar.shift_date);

  return (
    <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-medium">
              {format(shiftDate, 'EEEE d MMMM yyyy', { locale: th })}
            </span>
          </div>
          
          {shift && (
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-sm py-1 px-3">
                {shift.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Planned: {shiftCalendar.planned_time_minutes} นาที
            </span>
          </div>
          
          {isLocked && (
            <Badge variant="destructive">LOCKED</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
