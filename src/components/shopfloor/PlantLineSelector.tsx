import { Factory, GitBranch, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Plant, Line } from '@/services/types';

interface PlantLineSelectorProps {
  plants: Plant[];
  lines: Line[];
  selectedPlantId: string | null;
  selectedLineId: string | null;
  onPlantChange: (plantId: string | null) => void;
  onLineChange: (lineId: string | null) => void;
  isLoading?: boolean;
}

export function PlantLineSelector({
  plants,
  lines,
  selectedPlantId,
  selectedLineId,
  onPlantChange,
  onLineChange,
  isLoading = false,
}: PlantLineSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Plant Selector */}
      <div className="flex-1 min-w-0">
        <Select
          value={selectedPlantId || ''}
          onValueChange={(value) => onPlantChange(value || null)}
        >
          <SelectTrigger
            className={cn(
              'h-14 px-4 rounded-xl border-2 transition-all',
              'hover:border-primary/40',
              selectedPlantId
                ? 'border-primary/30 bg-primary/5'
                : 'border-border'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                selectedPlantId ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Factory className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none mb-1">Plant</p>
                <SelectValue placeholder="เลือก Plant" />
              </div>
            </div>
          </SelectTrigger>
          <SelectContent>
            {plants.map((plant) => (
              <SelectItem key={plant.id} value={plant.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{plant.name}</span>
                    {plant.code && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{plant.code}</span>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Arrow Connector */}
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />

      {/* Line Selector */}
      <div className="flex-1 min-w-0">
        <Select
          value={selectedLineId || ''}
          onValueChange={(value) => onLineChange(value || null)}
          disabled={!selectedPlantId}
        >
          <SelectTrigger
            className={cn(
              'h-14 px-4 rounded-xl border-2 transition-all',
              !selectedPlantId && 'opacity-50',
              'hover:border-primary/40',
              selectedLineId
                ? 'border-primary/30 bg-primary/5'
                : 'border-border'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                selectedLineId ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <GitBranch className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none mb-1">Line</p>
                <SelectValue placeholder={selectedPlantId ? 'เลือก Line' : 'เลือก Plant ก่อน'} />
              </div>
            </div>
          </SelectTrigger>
          <SelectContent>
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id} className="py-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{line.name}</span>
                    {line.code && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{line.code}</span>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
