import { useCallback } from 'react';
import { cn } from '@/lib/utils';

/** Parse "HH:MM:SS" or "HH:MM" into { h, m } */
function parseTime(timeStr: string): { h: number; m: number } {
  const parts = timeStr.split(':').map(Number);
  return { h: parts[0] || 0, m: parts[1] || 0 };
}

interface InlineTimeInputProps {
  value: string; // "HH:MM:SS" or "HH:MM"
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function InlineTimeInput({ value, onChange, disabled, className }: InlineTimeInputProps) {
  const time = parseTime(value);

  const handleChange = useCallback((field: 'h' | 'm', raw: string) => {
    const num = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = field === 'h' ? Math.min(23, Math.max(0, num)) : Math.min(59, Math.max(0, num));
    const newTime = { ...time, [field]: clamped };
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${pad(newTime.h)}:${pad(newTime.m)}:00`);
  }, [time, onChange]);

  const segmentClass = cn(
    "w-9 h-8 text-center font-mono text-sm tabular-nums px-0 rounded-md bg-background",
    "border-2 border-input hover:border-primary/50",
    "focus:ring-2 focus:ring-primary focus:border-primary outline-none",
    "transition-colors cursor-text",
    disabled && "opacity-50 cursor-not-allowed hover:border-input",
    className,
  );

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        className={segmentClass}
        value={String(time.h).padStart(2, '0')}
        onChange={(e) => handleChange('h', e.target.value)}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        aria-label="ชั่วโมง"
      />
      <span className="text-xs font-bold text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        className={segmentClass}
        value={String(time.m).padStart(2, '0')}
        onChange={(e) => handleChange('m', e.target.value)}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        aria-label="นาที"
      />
    </div>
  );
}
