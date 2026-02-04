import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Machine } from '@/services/types';

interface MachineSelectorProps {
  machines: Machine[];
  selectedMachineId: string | null;
  onMachineChange: (machineId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

function MachineSelectorSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 border rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Skeleton className="h-5 w-5 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MachineSelector({
  machines,
  selectedMachineId,
  onMachineChange,
  isLoading = false,
  disabled = false,
}: MachineSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 md:col-span-1">
        <Label className="text-sm font-medium">Machine</Label>
        <MachineSelectorSkeleton />
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Machine</Label>
        <div className="flex items-center justify-center h-12 border rounded-md bg-muted text-muted-foreground text-sm">
          เลือก Line ก่อน
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:col-span-1">
      <Label className="text-sm font-medium">Machine</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1">
        {machines.map((machine) => {
          const isSelected = machine.id === selectedMachineId;
          return (
            <Card
              key={machine.id}
              onClick={() => onMachineChange(isSelected ? null : machine.id)}
              className={cn(
                'cursor-pointer p-3 transition-all hover:shadow-md relative',
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                  : 'hover:border-primary/50'
              )}
            >
              {isSelected && (
                <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
              )}
              <div className="flex items-start gap-2">
                <Cpu className={cn(
                  'h-5 w-5 mt-0.5 shrink-0',
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                )} />
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'font-medium text-sm truncate',
                    isSelected && 'text-primary'
                  )}>
                    {machine.name}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {machine.code}
                  </Badge>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {machines.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          ไม่พบเครื่องจักรใน Line นี้
        </p>
      )}
    </div>
  );
}
