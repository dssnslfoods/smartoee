import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
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
  return (
    <>
      {/* Plant Selector */}
      <div className="space-y-2">
        <Label htmlFor="plant-select" className="text-sm font-medium">
          Plant
        </Label>
        <Select
          value={selectedPlantId || ''}
          onValueChange={(value) => onPlantChange(value || null)}
          disabled={isLoading}
        >
          <SelectTrigger id="plant-select" className="h-12 text-base">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue placeholder="เลือก Plant" />
            )}
          </SelectTrigger>
          <SelectContent>
            {plants.map((plant) => (
              <SelectItem key={plant.id} value={plant.id} className="text-base py-3">
                <div className="flex flex-col">
                  <span className="font-medium">{plant.name}</span>
                  {plant.code && (
                    <span className="text-xs text-muted-foreground">{plant.code}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line Selector */}
      <div className="space-y-2">
        <Label htmlFor="line-select" className="text-sm font-medium">
          Line
        </Label>
        <Select
          value={selectedLineId || ''}
          onValueChange={(value) => onLineChange(value || null)}
          disabled={!selectedPlantId || isLoading}
        >
          <SelectTrigger id="line-select" className="h-12 text-base">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue placeholder="เลือก Line" />
            )}
          </SelectTrigger>
          <SelectContent>
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id} className="text-base py-3">
                <div className="flex flex-col">
                  <span className="font-medium">{line.name}</span>
                  {line.code && (
                    <span className="text-xs text-muted-foreground">{line.code}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
