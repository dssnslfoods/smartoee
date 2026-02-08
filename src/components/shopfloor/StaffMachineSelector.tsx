import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cpu, CheckCircle2, Building2, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Machine } from '@/services/types';

interface StaffMachineSelectorProps {
  machines: Machine[];
  selectedMachineId: string | null;
  onMachineChange: (machineId: string | null) => void;
  isLoading?: boolean;
}

interface GroupedMachines {
  plantName: string;
  plantCode: string | undefined;
  lines: {
    lineName: string;
    lineCode: string | undefined;
    machines: Machine[];
  }[];
}

function StaffMachineSelectorSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function StaffMachineSelector({
  machines,
  selectedMachineId,
  onMachineChange,
  isLoading = false,
}: StaffMachineSelectorProps) {
  // Group machines by Plant > Line
  const grouped = useMemo((): GroupedMachines[] => {
    const plantMap = new Map<string, GroupedMachines>();

    for (const machine of machines) {
      const plantName = machine.line?.plant?.name ?? 'Unknown Plant';
      const plantCode = machine.line?.plant?.code ?? undefined;
      const plantKey = machine.line?.plant?.id ?? 'unknown';
      const lineName = machine.line?.name ?? 'Unknown Line';
      const lineCode = machine.line?.code ?? undefined;
      const lineKey = machine.line?.id ?? 'unknown';

      if (!plantMap.has(plantKey)) {
        plantMap.set(plantKey, { plantName, plantCode, lines: [] });
      }
      const plantGroup = plantMap.get(plantKey)!;

      let lineGroup = plantGroup.lines.find(
        (l) => l.lineName === lineName && l.lineCode === lineCode
      );
      if (!lineGroup) {
        lineGroup = { lineName, lineCode, machines: [] };
        plantGroup.lines.push(lineGroup);
      }
      lineGroup.machines.push(machine);
    }

    return Array.from(plantMap.values());
  }, [machines]);

  if (isLoading) {
    return <StaffMachineSelectorSkeleton />;
  }

  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl text-muted-foreground text-sm gap-2">
        <Cpu className="h-6 w-6 opacity-40" />
        <p>ยังไม่มีเครื่องจักรที่ได้รับสิทธิ์เข้าถึง</p>
        <p className="text-xs">กรุณาติดต่อ Supervisor เพื่อขอสิทธิ์</p>
      </div>
    );
  }

  return (
    <ScrollArea className={machines.length > 8 ? 'max-h-[400px]' : undefined}>
      <div className="space-y-5 pr-1">
        {grouped.map((plantGroup) => (
          <div key={plantGroup.plantName} className="space-y-3">
            {/* Plant header */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {plantGroup.plantName}
              </span>
              {plantGroup.plantCode && (
                <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                  {plantGroup.plantCode}
                </Badge>
              )}
            </div>

            {plantGroup.lines.map((lineGroup) => (
              <div key={lineGroup.lineName} className="space-y-2 pl-2">
                {/* Line header */}
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {lineGroup.lineName}
                  </span>
                  {lineGroup.lineCode && (
                    <Badge variant="outline" className="text-[9px] font-mono px-1">
                      {lineGroup.lineCode}
                    </Badge>
                  )}
                </div>

                {/* Machine grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pl-4">
                  {lineGroup.machines.map((machine) => {
                    const isSelected = machine.id === selectedMachineId;
                    return (
                      <button
                        key={machine.id}
                        onClick={() =>
                          onMachineChange(isSelected ? null : machine.id)
                        }
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
                        <div
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                            isSelected
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary/70'
                          )}
                        >
                          <Cpu className="h-5 w-5" />
                        </div>

                        {/* Machine info */}
                        <div className="min-w-0 w-full">
                          <p
                            className={cn(
                              'font-semibold text-sm leading-tight truncate',
                              isSelected && 'text-primary'
                            )}
                          >
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
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
