/**
 * Time Unit Conversion Utilities
 * 
 * Internally, all time values are stored in SECONDS.
 * This utility converts between seconds and the machine's preferred display unit.
 */

export type TimeUnit = 'seconds' | 'minutes';

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  seconds: 'วินาที (s)',
  minutes: 'นาที (min)',
};

export const TIME_UNIT_SHORT: Record<TimeUnit, string> = {
  seconds: 's',
  minutes: 'min',
};

/**
 * Convert from internal seconds to the display unit
 */
export function fromSeconds(valueInSeconds: number, unit: TimeUnit): number {
  if (unit === 'minutes') return valueInSeconds / 60;
  return valueInSeconds;
}

/**
 * Convert from display unit back to internal seconds
 */
export function toSeconds(value: number, unit: TimeUnit): number {
  if (unit === 'minutes') return value * 60;
  return value;
}

/**
 * Format a time value (in seconds) for display in the given unit
 */
export function formatTimeValue(valueInSeconds: number | undefined | null, unit: TimeUnit, decimals = 1): string {
  if (valueInSeconds == null) return '—';
  const converted = fromSeconds(valueInSeconds, unit);
  return converted.toFixed(decimals);
}

/**
 * Get the step value for number inputs based on unit
 */
export function getInputStep(unit: TimeUnit): string {
  return unit === 'minutes' ? '0.01' : '0.1';
}

/**
 * Get the minimum value for number inputs based on unit
 */
export function getInputMin(unit: TimeUnit): string {
  return unit === 'minutes' ? '0.01' : '0.1';
}

/**
 * Safely resolve a time_unit string to a TimeUnit enum value
 */
export function resolveTimeUnit(unit: string | undefined | null): TimeUnit {
  if (unit === 'seconds') return 'seconds';
  return 'minutes';
}
