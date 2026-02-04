import { cn } from '@/lib/utils';

interface OEEGaugeProps {
  value: number;
  label: string;
  color: 'availability' | 'performance' | 'quality' | 'overall';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  availability: 'text-oee-availability',
  performance: 'text-oee-performance',
  quality: 'text-oee-quality',
  overall: 'text-oee-overall',
};

const bgColorClasses = {
  availability: 'stroke-oee-availability',
  performance: 'stroke-oee-performance',
  quality: 'stroke-oee-quality',
  overall: 'stroke-oee-overall',
};

const sizeClasses = {
  sm: { size: 100, stroke: 8, text: 'text-lg', label: 'text-xs' },
  md: { size: 140, stroke: 10, text: 'text-2xl', label: 'text-sm' },
  lg: { size: 180, stroke: 12, text: 'text-3xl', label: 'text-base' },
};

export function OEEGauge({ value, label, color, size = 'md' }: OEEGaugeProps) {
  const { size: gaugeSize, stroke, text, label: labelSize } = sizeClasses[size];
  const radius = (gaugeSize - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
        <svg
          className="rotate-[-90deg]"
          width={gaugeSize}
          height={gaugeSize}
        >
          {/* Background circle */}
          <circle
            cx={gaugeSize / 2}
            cy={gaugeSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={gaugeSize / 2}
            cy={gaugeSize / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-all duration-500', bgColorClasses[color])}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold', text, colorClasses[color])}>
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className={cn('mt-2 font-medium text-muted-foreground', labelSize)}>
        {label}
      </span>
    </div>
  );
}
