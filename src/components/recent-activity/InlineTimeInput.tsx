import { useCallback } from 'react';
import { cn } from '@/lib/utils';

/** Parse "HH:MM:SS" or "HH:MM" into { h, m, s } */
function parseTime(timeStr: string): { h: number; m: number; s: number } {
  const parts = timeStr.split(':').map(Number);
  return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 };
}

interface InlineTimeInputProps {
  value: string; // "HH:MM:SS"
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function InlineTimeInput({ value, onChange, disabled, className }: InlineTimeInputProps) {
  const time = parseTime(value);

  const handleChange = useCallback((field: 'h' | 'm' | 's', raw: string) => {
    const num = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = field === 'h' ? Math.min(23, Math.max(0, num)) : Math.min(59, Math.max(0, num));
    const newTime = { ...time, [field]: clamped };
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${pad(newTime.h)}:${pad(newTime.m)}:${pad(newTime.s)}`);
  }, [time, onChange]);

  const segmentClass = cn(
    "w-8 h-7 text-center font-mono text-sm tabular-nums px-0 border rounded bg-background",
    "focus:ring-2 focus:ring-primary focus:border-primary outline-none",
    disabled && "opacity-50 cursor-not-allowed",
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
      <span className="text-xs font-bold text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        className={segmentClass}
        value={String(time.s).padStart(2, '0')}
        onChange={(e) => handleChange('s', e.target.value)}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        aria-label="วินาที"
      />
    </div>
  );
}
