import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'availability' | 'performance' | 'quality' | 'overall' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantStyles = {
  default: {
    border: 'border-l-primary',
    value: 'text-foreground',
    icon: 'bg-primary/10 text-primary',
  },
  availability: {
    border: 'border-l-oee-availability',
    value: 'text-oee-availability',
    icon: 'bg-oee-availability/10 text-oee-availability',
  },
  performance: {
    border: 'border-l-oee-performance',
    value: 'text-oee-performance',
    icon: 'bg-oee-performance/10 text-oee-performance',
  },
  quality: {
    border: 'border-l-oee-quality',
    value: 'text-oee-quality',
    icon: 'bg-oee-quality/10 text-oee-quality',
  },
  overall: {
    border: 'border-l-oee-overall',
    value: 'text-oee-overall',
    icon: 'bg-oee-overall/10 text-oee-overall',
  },
  success: {
    border: 'border-l-status-running',
    value: 'text-status-running',
    icon: 'bg-status-running/10 text-status-running',
  },
  warning: {
    border: 'border-l-status-idle',
    value: 'text-status-idle',
    icon: 'bg-status-idle/10 text-status-idle',
  },
  danger: {
    border: 'border-l-status-stopped',
    value: 'text-status-stopped',
    icon: 'bg-status-stopped/10 text-status-stopped',
  },
};

export function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-l-4 bg-card p-4 sm:p-5 transition-all hover:shadow-md',
      styles.border,
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {label}
          </p>
          <p className={cn('text-2xl sm:text-3xl font-bold tracking-tight mt-1', styles.value)}>
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {subValue}
            </p>
          )}
          {trend && trendValue && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              trend === 'up' && 'text-status-running',
              trend === 'down' && 'text-status-stopped',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
