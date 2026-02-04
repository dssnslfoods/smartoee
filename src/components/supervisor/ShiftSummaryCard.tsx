import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock } from 'lucide-react';

interface ShiftSummaryCardProps {
  shiftName: string;
  shiftDate: string;
  status: string | null;
  machineCount: number;
  plannedTime: number;
  children?: React.ReactNode;
}

export function ShiftSummaryCard({
  shiftName,
  shiftDate,
  status,
  machineCount,
  plannedTime,
  children,
}: ShiftSummaryCardProps) {
  const getStatusBadge = () => {
    if (!status || status === 'DRAFT') {
      return <Badge variant="secondary">Draft</Badge>;
    }
    if (status === 'APPROVED') {
      return (
        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (status === 'LOCKED') {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
          <Lock className="h-3 w-3 mr-1" />
          Locked
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {shiftName}
              {getStatusBadge()}
            </CardTitle>
            <CardDescription>
              {format(new Date(shiftDate), 'EEEE d MMMM yyyy', { locale: th })}
            </CardDescription>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>เครื่องจักร: {machineCount}</div>
            <div>เวลาที่วางแผน: {plannedTime} นาที</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
