import { Activity, Hash, ScrollText, ClipboardCheck, Cpu, Package, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntityTypeChip {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgActiveClass: string;
}

export const ENTITY_TYPE_CHIPS: EntityTypeChip[] = [
  { key: 'all', label: 'ทั้งหมด', icon: ScrollText, colorClass: 'text-foreground', bgActiveClass: 'bg-primary text-primary-foreground' },
  { key: 'production_events', label: 'เหตุการณ์การผลิต', icon: Activity, colorClass: 'text-status-running', bgActiveClass: 'bg-status-running text-white' },
  { key: 'production_counts', label: 'จำนวนผลิต', icon: Hash, colorClass: 'text-primary', bgActiveClass: 'bg-primary text-primary-foreground' },
  { key: 'shift_approvals', label: 'อนุมัติกะ', icon: ClipboardCheck, colorClass: 'text-muted-foreground', bgActiveClass: 'bg-muted-foreground text-background' },
  { key: 'machines', label: 'เครื่องจักร', icon: Cpu, colorClass: 'text-muted-foreground', bgActiveClass: 'bg-muted-foreground text-background' },
  { key: 'products', label: 'สินค้า', icon: Package, colorClass: 'text-muted-foreground', bgActiveClass: 'bg-muted-foreground text-background' },
  { key: 'production_standards', label: 'มาตรฐาน', icon: Settings, colorClass: 'text-muted-foreground', bgActiveClass: 'bg-muted-foreground text-background' },
  { key: 'other', label: 'อื่นๆ', icon: AlertTriangle, colorClass: 'text-muted-foreground', bgActiveClass: 'bg-muted-foreground text-background' },
];

const KNOWN_ENTITY_TYPES = new Set(['production_events', 'production_counts', 'shift_approvals', 'machines', 'products', 'production_standards']);

export function matchesChipFilter(
  chipKey: string,
  entityType: string,
  _afterJson: Record<string, unknown> | null,
  _beforeJson: Record<string, unknown> | null,
): boolean {
  if (chipKey === 'all') return true;

  if (chipKey === 'other') {
    return !KNOWN_ENTITY_TYPES.has(entityType);
  }

  return entityType === chipKey;
}

interface EntityTypeChipsProps {
  selected: string;
  onSelect: (key: string) => void;
}

export function EntityTypeChips({ selected, onSelect }: EntityTypeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ENTITY_TYPE_CHIPS.map((chip) => {
        const isActive = selected === chip.key;
        const Icon = chip.icon;
        return (
          <button
            key={chip.key}
            onClick={() => onSelect(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? cn(chip.bgActiveClass, 'border-transparent shadow-sm')
                : cn('bg-background border-border', chip.colorClass, 'hover:bg-muted/60')
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
