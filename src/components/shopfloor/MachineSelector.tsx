import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
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
    return <MachineSelectorSkeleton />;
  }

  if (disabled) {
    return (
      <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
        <Cpu className="h-5 w-5 mr-2 opacity-40" />
        เลือก Plant & Line ก่อน
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
        <Cpu className="h-5 w-5 mr-2 opacity-40" />
        ไม่พบเครื่องจักรใน Line นี้
      </div>
    );
  }

  return (
    <ScrollArea className={machines.length > 8 ? 'max-h-[220px]' : undefined}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pr-1">
        {machines.map((machine) => {
          const isSelected = machine.id === selectedMachineId;
          return (
            <button
              key={machine.id}
              onClick={() => onMachineChange(isSelected ? null : machine.id)}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center min-h-[80px]',
                'hover:shadow-md hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-md shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:bg-accent/30'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5">
                  <CheckCircle2 className="h-5 w-5 text-primary fill-primary/20" />
                </div>
              )}

              {/* Icon */}
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                isSelected
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary/70'
              )}>
                <Cpu className="h-5 w-5" />
              </div>

              {/* Machine info */}
              <div className="min-w-0 w-full">
                <p className={cn(
                  'font-semibold text-sm leading-tight truncate',
                  isSelected && 'text-primary'
                )}>
                  {machine.name}
                </p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-[10px] mt-1 font-mono px-1.5',
                    isSelected && 'border-primary/30 text-primary'
                  )}
                >
                  {machine.code}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
