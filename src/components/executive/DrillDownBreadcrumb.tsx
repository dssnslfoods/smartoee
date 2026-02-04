import { ChevronRight, Factory, Layers, Cpu, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DrillLevel = 'plant' | 'line' | 'machine' | 'shift';

interface BreadcrumbItem {
  level: DrillLevel;
  id: string;
  name: string;
}

interface DrillDownBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (level: DrillLevel, id?: string) => void;
}

const levelIcons: Record<DrillLevel, React.ElementType> = {
  plant: Factory,
  line: Layers,
  machine: Cpu,
  shift: Clock,
};

const levelLabels: Record<DrillLevel, string> = {
  plant: 'All Plants',
  line: 'All Lines',
  machine: 'All Machines',
  shift: 'All Shifts',
};

export function DrillDownBreadcrumb({ items, onNavigate }: DrillDownBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate('plant')}
        className={cn(
          'h-8 px-2',
          items.length === 0 && 'bg-accent text-accent-foreground'
        )}
      >
        <Factory className="h-4 w-4 mr-1" />
        Overview
      </Button>

      {items.map((item, index) => {
        const Icon = levelIcons[item.level];
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.level}-${item.id}`} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(item.level, item.id)}
              className={cn(
                'h-8 px-2',
                isLast && 'bg-accent text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 mr-1" />
              {item.name}
            </Button>
          </div>
        );
      })}
    </nav>
  );
}

export function DrillDownSelector({
  level,
  items,
  onSelect,
  selectedId,
}: {
  level: DrillLevel;
  items: { id: string; name: string; oee?: number }[];
  onSelect: (id: string) => void;
  selectedId?: string;
}) {
  const Icon = levelIcons[level];

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <Button
          key={item.id}
          variant={selectedId === item.id ? 'default' : 'outline'}
          className="h-auto p-4 justify-start"
          onClick={() => onSelect(item.id)}
        >
          <Icon className="h-5 w-5 mr-3" />
          <div className="flex-1 text-left">
            <div className="font-medium">{item.name}</div>
            {item.oee !== undefined && (
              <div className="text-xs text-muted-foreground">
                OEE: {item.oee.toFixed(1)}%
              </div>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}
