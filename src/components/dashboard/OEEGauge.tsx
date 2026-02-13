import { cn } from '@/lib/utils';

interface OEEGaugeProps {
  value: number;
  label: string;
  color: 'availability' | 'performance' | 'quality' | 'overall';
  size?: 'sm' | 'md' | 'lg';
}

const colorConfig = {
  availability: {
    stroke: 'hsl(var(--oee-availability))',
    text: 'text-oee-availability',
    track: 'hsl(var(--oee-availability) / 0.15)',
  },
  performance: {
    stroke: 'hsl(var(--oee-performance))',
    text: 'text-oee-performance',
    track: 'hsl(var(--oee-performance) / 0.15)',
  },
  quality: {
    stroke: 'hsl(var(--oee-quality))',
    text: 'text-oee-quality',
    track: 'hsl(var(--oee-quality) / 0.15)',
  },
  overall: {
    stroke: 'hsl(var(--oee-overall))',
    text: 'text-oee-overall',
    track: 'hsl(var(--oee-overall) / 0.15)',
  },
};

const sizeConfig = {
  sm: { svgSize: 100, strokeWidth: 8, valueFontClass: 'text-lg font-bold', labelFontClass: 'text-[10px]' },
  md: { svgSize: 150, strokeWidth: 12, valueFontClass: 'text-2xl font-bold', labelFontClass: 'text-xs' },
  lg: { svgSize: 200, strokeWidth: 14, valueFontClass: 'text-4xl font-bold', labelFontClass: 'text-sm' },
};

export function OEEGauge({ value, label, color, size = 'md' }: OEEGaugeProps) {
  const { svgSize, strokeWidth, valueFontClass, labelFontClass } = sizeConfig[size];
  const { stroke, text: textClass, track } = colorConfig[color];

  const center = svgSize / 2;
  const radius = (svgSize - strokeWidth - 4) / 2;

  // Arc from 135° to 405° (270° sweep, bottom-open)
  const startDeg = 135;
  const sweepDeg = 270;
  const clampedValue = Math.min(100, Math.max(0, value));
  const valueSweep = (clampedValue / 100) * sweepDeg;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const px = (deg: number, r: number) => center + r * Math.cos(toRad(deg));
  const py = (deg: number, r: number) => center + r * Math.sin(toRad(deg));

  const describeArc = (startA: number, sweep: number, r: number) => {
    const endA = startA + sweep;
    const large = sweep > 180 ? 1 : 0;
    return `M ${px(startA, r)} ${py(startA, r)} A ${r} ${r} 0 ${large} 1 ${px(endA, r)} ${py(endA, r)}`;
  };

  // Tick marks (every 10%)
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const deg = startDeg + (i / 10) * sweepDeg;
    const major = i % 5 === 0;
    const len = major ? strokeWidth * 0.9 : strokeWidth * 0.5;
    return {
      x1: px(deg, radius + strokeWidth / 2 + 2),
      y1: py(deg, radius + strokeWidth / 2 + 2),
      x2: px(deg, radius + strokeWidth / 2 + 2 + len),
      y2: py(deg, radius + strokeWidth / 2 + 2 + len),
      major,
    };
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="overflow-visible">
          {/* Tick marks (behind arc) */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="currentColor"
              strokeWidth={t.major ? 2 : 1}
              strokeLinecap="round"
              className={t.major ? 'text-muted-foreground/40' : 'text-muted-foreground/20'}
            />
          ))}

          {/* Background track */}
          <path
            d={describeArc(startDeg, sweepDeg, radius)}
            fill="none"
            stroke={track}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value arc */}
          {clampedValue > 0 && (
            <path
              d={describeArc(startDeg, valueSweep, radius)}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
            />
          )}

          {/* End-cap dot */}
          {clampedValue > 0 && (
            <circle
              cx={px(startDeg + valueSweep, radius)}
              cy={py(startDeg + valueSweep, radius)}
              r={strokeWidth / 2 + 2}
              fill={stroke}
              className="transition-all duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 8px ${stroke})` }}
            />
          )}
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('tabular-nums tracking-tight leading-none', valueFontClass, textClass)}>
            {value.toFixed(1)}%
          </span>
        </div>
      </div>

      {label && (
        <span className={cn('font-semibold text-muted-foreground uppercase tracking-[0.15em]', labelFontClass)}>
          {label}
        </span>
      )}
    </div>
  );
}
