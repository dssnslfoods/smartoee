import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, differenceInMinutes, parse, getDay } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Play, Pause, Wrench, Package, Loader2, CalendarIcon, Clock, ChevronDown, ChevronUp,
  Check, Search, ArrowRight, Info, FileText, AlertTriangle, CalendarOff, Coffee,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export interface ManualEventDefaults {
  machineId?: string;
  eventDate?: string;
  startTime?: string;
}

interface CreateManualEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  defaults?: ManualEventDefaults;
}

const EVENT_TYPES = [
  { value: 'RUN', label: 'Running', labelTh: 'เดินเครื่อง', icon: Play, bgColor: 'bg-emerald-50 dark:bg-emerald-950/40', borderColor: 'border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-700 dark:text-emerald-400', selectedBg: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-900' },
  { value: 'DOWNTIME', label: 'Downtime', labelTh: 'หยุดเครื่อง', icon: Pause, bgColor: 'bg-red-50 dark:bg-red-950/40', borderColor: 'border-red-200 dark:border-red-800', textColor: 'text-red-700 dark:text-red-400', selectedBg: 'bg-red-500', iconBg: 'bg-red-100 dark:bg-red-900' },
  { value: 'SETUP', label: 'Setup', labelTh: 'ตั้งค่าเครื่อง', icon: Wrench, bgColor: 'bg-amber-50 dark:bg-amber-950/40', borderColor: 'border-amber-200 dark:border-amber-800', textColor: 'text-amber-700 dark:text-amber-400', selectedBg: 'bg-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900' },
] as const;

/** Quick date presets */
const DATE_PRESETS = [
  { label: 'วันนี้', getValue: () => new Date() },
  { label: 'เมื่อวาน', getValue: () => subDays(new Date(), 1) },
  { label: '2 วันก่อน', getValue: () => subDays(new Date(), 2) },
];

/** Quick time presets */
const TIME_PRESETS = [
  { label: '06:00', value: '06:00' },
  { label: '08:00', value: '08:00' },
  { label: '14:00', value: '14:00' },
  { label: '18:00', value: '18:00' },
  { label: '22:00', value: '22:00' },
];

function parseHHMM(timeStr: string): { h: number; m: number } {
  const parts = timeStr.split(':').map(Number);
  return { h: parts[0] || 0, m: parts[1] || 0 };
}

function formatHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function TimeInput({ value, onChange, label, disabled }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const time = parseHHMM(value);

  const handleChange = (field: 'h' | 'm', raw: string) => {
    const num = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = field === 'h' ? Math.min(23, Math.max(0, num)) : Math.min(59, Math.max(0, num));
    const newTime = { ...time, [field]: clamped };
    onChange(`${formatHHMM(newTime.h, newTime.m)}:00`);
  };

  const adjust = (field: 'h' | 'm', delta: number) => {
    let newVal = (field === 'h' ? time.h : time.m) + delta;
    const max = field === 'h' ? 24 : 60;
    newVal = (newVal + max) % max;
    const newTime = { ...time, [field]: newVal };
    onChange(`${formatHHMM(newTime.h, newTime.m)}:00`);
  };

  const segmentClass = cn(
    "w-12 h-10 text-center font-mono text-base tabular-nums px-0 rounded-lg bg-background",
    "border border-input hover:border-primary/50",
    "focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none",
    "transition-all",
    disabled && "opacity-50 cursor-not-allowed hover:border-input",
  );

  const btnClass = cn(
    "flex items-center justify-center w-5 h-4 hover:bg-accent text-muted-foreground",
    "transition-colors",
    disabled && "pointer-events-none opacity-50"
  );

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-border shadow-sm">
        {/* Hours */}
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjust('h', 1)} className={cn(btnClass, "rounded-t-md")} disabled={disabled}>
            <ChevronUp className="h-3 w-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            className={cn(segmentClass, "h-8 w-11 text-sm border-none")}
            value={String(time.h).padStart(2, '0')}
            onChange={(e) => handleChange('h', e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
          />
          <button type="button" onClick={() => adjust('h', -1)} className={cn(btnClass, "rounded-b-md")} disabled={disabled}>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <span className="text-lg font-bold text-muted-foreground/30">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => adjust('m', 1)} className={cn(btnClass, "rounded-t-md")} disabled={disabled}>
            <ChevronUp className="h-3 w-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            className={cn(segmentClass, "h-8 w-11 text-sm border-none")}
            value={String(time.m).padStart(2, '0')}
            onChange={(e) => handleChange('m', e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
          />
          <button type="button" onClick={() => adjust('m', -1)} className={cn(btnClass, "rounded-b-md")} disabled={disabled}>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateManualEventDialog({ open, onOpenChange, companyId, defaults }: CreateManualEventDialogProps) {
  const queryClient = useQueryClient();

  const [machineId, setMachineId] = useState(defaults?.machineId || '');
  const [eventType, setEventType] = useState<string>('RUN');
  const [startTime, setStartTime] = useState(defaults?.startTime || '08:00:00');
  const [endTime, setEndTime] = useState('09:00:00');
  const [hasEndTime, setHasEndTime] = useState(true);
  const [productId, setProductId] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(defaults?.eventDate || format(new Date(), 'yyyy-MM-dd'));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');

  // Sync defaults when dialog opens with new defaults
  const [lastDefaults, setLastDefaults] = useState(defaults);
  if (open && defaults && defaults !== lastDefaults) {
    setLastDefaults(defaults);
    if (defaults.machineId) setMachineId(defaults.machineId);
    if (defaults.startTime) setStartTime(defaults.startTime);
    if (defaults.eventDate) setEventDate(defaults.eventDate);
  }

  // Reset product when machine changes
  useEffect(() => {
    setProductId('');
    setSkuSearch('');
  }, [machineId]);

  // Fetch machines
  const { data: machines = [] } = useQuery({
    queryKey: ['manual-event-machines', companyId],
    queryFn: async () => {
      const { data: permittedIds } = await supabase.rpc('get_user_permitted_machine_ids');
      if (!permittedIds || permittedIds.length === 0) return [];
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, code, line_id')
        .eq('is_active', true)
        .in('id', permittedIds)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Get plant_id for the selected machine
  const selectedMachineFull = machines.find((m) => m.id === machineId);

  const { data: machinePlantId } = useQuery({
    queryKey: ['manual-event-plant', machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('plant_id')
        .eq('id', selectedMachineFull!.line_id)
        .single();
      if (error) throw error;
      return data?.plant_id as string;
    },
    enabled: open && !!machineId && !!selectedMachineFull?.line_id,
  });

  // Fetch shifts for the plant
  const { data: shifts = [] } = useQuery({
    queryKey: ['manual-event-shifts', machinePlantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, name, start_time, end_time, working_days, effective_from')
        .eq('plant_id', machinePlantId!)
        .eq('is_active', true)
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!machinePlantId,
  });

  // Fetch holidays for the plant
  const { data: holidays = [] } = useQuery({
    queryKey: ['manual-event-holidays', machinePlantId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('holiday_date, name, is_recurring, plant_id')
        .eq('company_id', companyId!)
        .or(`plant_id.is.null,plant_id.eq.${machinePlantId}`);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!machinePlantId && !!companyId,
  });

  // Fetch break times from planned_time_templates
  const { data: breakTemplates = [] } = useQuery({
    queryKey: ['manual-event-breaks', machinePlantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planned_time_templates')
        .select('shift_id, break_start_time, break_end_time, effective_from')
        .eq('plant_id', machinePlantId!)
        .eq('is_active', true)
        .not('break_start_time', 'is', null)
        .not('break_end_time', 'is', null)
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!machinePlantId,
  });

  const needsReason = eventType === 'DOWNTIME' || eventType === 'SETUP';
  const needsProduct = eventType === 'RUN';

  // Fetch existing events for overlap check
  const { data: existingEvents = [] } = useQuery({
    queryKey: ['manual-event-overlaps', machineId, eventDate],
    queryFn: async () => {
      const start = new Date(`${eventDate}T00:00:00`);
      const end = new Date(`${eventDate}T23:59:59`);
      const { data, error } = await supabase
        .from('production_events')
        .select('id, start_ts, end_ts, event_type')
        .eq('machine_id', machineId)
        .or(`and(start_ts.gte.${start.toISOString()},start_ts.lte.${end.toISOString()}),and(end_ts.gte.${start.toISOString()},end_ts.lte.${end.toISOString()})`);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!machineId && !!eventDate,
  });

  // ─── Validation: shift, holiday, break ───
  const timeWarnings = useMemo(() => {
    const warnings: { type: 'holiday' | 'no_shift' | 'break' | 'overlap' | 'no_sku'; message: string; severity: 'error' | 'warning' }[] = [];
    if (!machineId || !eventDate) return warnings;

    const selectedDate = parse(eventDate, 'yyyy-MM-dd', new Date());
    const dow = getDay(selectedDate); // 0=Sunday
    const dateMonth = (selectedDate.getMonth() + 1);
    const dateDay = selectedDate.getDate();

    // 1) Check holidays
    const matchedHoliday = holidays.find((h) => {
      if (h.is_recurring) {
        const hDate = new Date(h.holiday_date);
        return hDate.getMonth() + 1 === dateMonth && hDate.getDate() === dateDay;
      }
      return h.holiday_date === eventDate;
    });
    if (matchedHoliday) {
      warnings.push({
        type: 'holiday',
        message: `วันที่ ${format(selectedDate, 'd MMM yyyy', { locale: th })} เป็นวันหยุด "${matchedHoliday.name}" — ไม่สามารถบันทึกเหตุการณ์ได้`,
        severity: 'error',
      });
      return warnings; // No point checking further
    }

    // 2) Check if date falls within any active shift's working_days and time range
    if (shifts.length > 0 && startTime) {
      const startHHMM = startTime.substring(0, 5); // "HH:MM"

      const matchingShift = shifts.find((s) => {
        // Check working_days
        if (!s.working_days?.includes(dow)) return false;
        // Check effective_from
        if (s.effective_from && eventDate < s.effective_from) return false;
        // Check time range
        const st = s.start_time?.substring(0, 5);
        const et = s.end_time?.substring(0, 5);
        if (!st || !et) return false;

        if (st <= et) {
          // Normal shift (e.g., 08:00 - 17:00)
          return startHHMM >= st && startHHMM < et;
        } else {
          // Overnight shift (e.g., 22:00 - 06:00)
          return startHHMM >= st || startHHMM < et;
        }
      });

      if (!matchingShift) {
        const shiftNames = shifts
          .filter((s) => s.working_days?.includes(dow))
          .map((s) => `${s.name} (${s.start_time?.substring(0, 5)}–${s.end_time?.substring(0, 5)})`)
          .join(', ');

        warnings.push({
          type: 'no_shift',
          message: shiftNames
            ? `เวลาเริ่ม ${startHHMM} ไม่อยู่ในช่วงกะทำงาน — กะที่มี: ${shiftNames}`
            : `วันที่เลือกไม่มีกะทำงานที่ตรงกัน — ตรวจสอบตารางกะทำงาน`,
          severity: 'error',
        });
      }

      // 3) Check end time exceeds shift boundary
      if (matchingShift && hasEndTime && endTime) {
        const endHHMM = endTime.substring(0, 5);
        const shiftEnd = matchingShift.end_time?.substring(0, 5);
        const shiftStart = matchingShift.start_time?.substring(0, 5);
        if (shiftStart && shiftEnd) {
          if (shiftStart <= shiftEnd) {
            // Normal shift — end time must be <= shift end
            if (endHHMM > shiftEnd) {
              warnings.push({
                type: 'no_shift',
                message: `เวลาสิ้นสุด ${endHHMM} เกินช่วงกะทำงาน (${shiftStart}–${shiftEnd}) — กรุณาเลือกเวลาสิ้นสุดไม่เกิน ${shiftEnd}`,
                severity: 'error',
              });
            }
          } else {
            // Overnight shift — end time must be <= shift end (next day portion)
            if (startHHMM >= shiftStart && endHHMM > shiftEnd && endHHMM < shiftStart) {
              warnings.push({
                type: 'no_shift',
                message: `เวลาสิ้นสุด ${endHHMM} เกินช่วงกะทำงาน (${shiftStart}–${shiftEnd}) — กรุณาเลือกเวลาสิ้นสุดไม่เกิน ${shiftEnd}`,
                severity: 'error',
              });
            }
          }
        }
      }

      // 4) Check break time
      if (matchingShift) {
        const breakTpl = breakTemplates.find(
          (b) => b.shift_id === matchingShift.id && (!b.effective_from || b.effective_from <= eventDate)
        );
        if (breakTpl?.break_start_time && breakTpl?.break_end_time) {
          const bStart = breakTpl.break_start_time.substring(0, 5);
          const bEnd = breakTpl.break_end_time.substring(0, 5);
          if (startHHMM >= bStart && startHHMM < bEnd) {
            warnings.push({
              type: 'break',
              message: `เวลาเริ่ม ${startHHMM} ตรงกับช่วงพัก (${bStart}–${bEnd}) — ไม่สามารถบันทึกเหตุการณ์ในช่วงพักได้`,
              severity: 'error',
            });
          }
          // Also check end time if specified
          if (hasEndTime && endTime) {
            const endHHMM = endTime.substring(0, 5);
            if (endHHMM > bStart && startHHMM < bEnd) {
              // Time range overlaps with break
              if (!warnings.some((w) => w.type === 'break')) {
                warnings.push({
                  type: 'break',
                  message: `ช่วงเวลา ${startHHMM}–${endHHMM} ทับซ้อนกับช่วงพัก (${bStart}–${bEnd}) — ไม่สามารถบันทึกเหตุการณ์ในช่วงพักได้`,
                  severity: 'error',
                });
              }
            }
          }
        }
      }
    }

    // 5) Check for overlapping events
    if (existingEvents.length > 0 && startTime) {
      try {
        const newStart = new Date(`${eventDate}T${startTime}`);
        const newEnd = hasEndTime && endTime ? new Date(`${eventDate}T${endTime}`) : null;

        const overlap = existingEvents.find((evt) => {
          const estart = new Date(evt.start_ts);
          const eend = evt.end_ts ? new Date(evt.end_ts) : null;

          // Case 1: New event starts during existing event
          const startOverlap = newStart >= estart && (!eend || newStart < eend);
          // Case 2: New event ends during existing event
          const endOverlap = newEnd && newEnd > estart && (!eend || newEnd <= eend);
          // Case 3: New event completely contains existing event
          const containOverlap = newStart <= estart && newEnd && (!eend || newEnd >= eend);
          // Case 4: Both events are open-ended
          const bothOpenOverlap = !newEnd && !eend;

          return startOverlap || endOverlap || containOverlap || bothOpenOverlap;
        });

        if (overlap) {
          const typeLabel = EVENT_TYPES.find((t) => t.value === overlap.event_type)?.labelTh || overlap.event_type;
          const timeRange = `${format(new Date(overlap.start_ts), 'HH:mm', { locale: th })}–${overlap.end_ts ? format(new Date(overlap.end_ts), 'HH:mm', { locale: th }) : 'กำลังดำเนินการ'}`;

          warnings.push({
            type: 'overlap',
            message: `ช่วงเวลาทับซ้อนกับเหตุการณ์ "${typeLabel}" (${timeRange}) — กรุณาเลือกช่วงเวลาอื่น`,
            severity: 'error',
          });
        }
      } catch (e) {
        console.error('Error checking overlap:', e);
      }
    }

    // 6) Check for SKU selection
    if (needsProduct && !productId) {
      warnings.push({
        type: 'no_sku',
        message: 'กรุณาเลือกสินค้า (SKU) ก่อนบันทึกเหตุการณ์',
        severity: 'error',
      });
    }

    return warnings;
  }, [machineId, eventDate, startTime, endTime, hasEndTime, shifts, holidays, breakTemplates, existingEvents, needsProduct, productId]);

  const hasBlockingWarning = timeWarnings.some((w) => w.severity === 'error');

  // Fetch production_standards for selected machine → map to products
  const { data: machineProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['manual-event-machine-products', machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_standards')
        .select('product_id, ideal_cycle_time_seconds, products!inner(id, name, code)')
        .eq('machine_id', machineId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.products.id as string,
        name: row.products.name as string,
        code: row.products.code as string,
        cycleTime: row.ideal_cycle_time_seconds as number,
      }));
    },
    enabled: open && !!machineId && eventType === 'RUN',
  });


  // Fetch downtime reasons
  const { data: reasons = [] } = useQuery({
    queryKey: ['manual-event-reasons', companyId],
    queryFn: async () => {
      let q = supabase.from('downtime_reasons').select('id, name, code, category').eq('is_active', true);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && (eventType === 'DOWNTIME' || eventType === 'SETUP'),
  });


  // Product list: ONLY allow machine-specific standards
  const displayProducts = machineProducts;
  const hasMachineStandards = machineProducts.length > 0;

  const filteredProducts = useMemo(() => {
    if (!skuSearch.trim()) return displayProducts;
    const q = skuSearch.toLowerCase();
    return displayProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [displayProducts, skuSearch]);

  // Duration calculation
  const durationMinutes = useMemo(() => {
    if (!hasEndTime) return null;
    try {
      const start = parse(startTime.substring(0, 5), 'HH:mm', new Date());
      const end = parse(endTime.substring(0, 5), 'HH:mm', new Date());
      const mins = differenceInMinutes(end, start);
      return mins > 0 ? mins : null;
    } catch { return null; }
  }, [startTime, endTime, hasEndTime]);

  const isValid = useMemo(() => {
    if (!machineId) return false;
    if (!eventType) return false;
    if (!startTime) return false;
    if (hasEndTime && !endTime) return false;
    if (needsReason && !reasonId) return false;
    if (needsProduct && !productId) return false;
    if (hasBlockingWarning) return false;
    return true;
  }, [machineId, eventType, startTime, endTime, hasEndTime, needsReason, reasonId, hasBlockingWarning]);

  const mutation = useMutation({
    mutationFn: async () => {
      const startFull = new Date(`${eventDate}T${startTime}`);
      const endFull = hasEndTime ? new Date(`${eventDate}T${endTime}`) : null;

      const { data, error } = await supabase.rpc('rpc_create_manual_event' as any, {
        p_machine_id: machineId,
        p_event_type: eventType,
        p_start_ts: startFull.toISOString(),
        p_end_ts: endFull ? endFull.toISOString() : null,
        p_reason_id: needsReason && reasonId ? reasonId : null,
        p_product_id: needsProduct && productId ? productId : null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(
          result?.error === 'SHIFT_LOCKED' ? 'SHIFT_LOCKED'
            : result?.error === 'OVERLAP_EVENT' ? result?.message || 'OVERLAP_EVENT'
              : result?.error === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED'
                : result?.message || 'Unknown error'
        );
      }
      return result;
    },
    onSuccess: () => {
      toast.success('สร้างเหตุการณ์สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message.includes('SHIFT_LOCKED')) {
        toast.error('ไม่สามารถสร้างได้ — กะถูกล็อกแล้ว');
      } else if (err.message.includes('OVERLAP_EVENT') || err.message.includes('ซ้อนทับ')) {
        toast.error('เหตุการณ์ซ้อนทับกับเหตุการณ์อื่นในช่วงเวลานี้');
      } else if (err.message.includes('PERMISSION_DENIED')) {
        toast.error('ไม่มีสิทธิ์ในเครื่องจักรนี้');
      } else {
        toast.error(err.message);
      }
    },
  });

  const resetForm = () => {
    setMachineId('');
    setEventType('RUN');
    setStartTime('08:00:00');
    setEndTime('09:00:00');
    setHasEndTime(true);
    setProductId('');
    setReasonId('');
    setNotes('');
    setEventDate(format(new Date(), 'yyyy-MM-dd'));
    setSkuSearch('');
  };

  const selectedMachine = selectedMachineFull;
  const selectedProduct = displayProducts.find((p) => p.id === productId);
  const parsedDate = eventDate ? parse(eventDate, 'yyyy-MM-dd', new Date()) : new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            สร้างเหตุการณ์ Manual
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            บันทึกเหตุการณ์การผลิตย้อนหลังด้วยเวลาที่กำหนดเอง
          </p>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* ─── Machine Selection ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
              เครื่องจักร
            </Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="เลือกเครื่องจักร..." />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground ml-1.5">({m.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ─── Event Type ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
              ประเภทเหตุการณ์
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map((et) => {
                const Icon = et.icon;
                const selected = eventType === et.value;
                return (
                  <button
                    key={et.value}
                    type="button"
                    onClick={() => {
                      setEventType(et.value);
                      if (et.value === 'RUN') { setReasonId(''); }
                      else { setProductId(''); setSkuSearch(''); }
                    }}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200',
                      selected
                        ? `${et.bgColor} ${et.borderColor} shadow-sm`
                        : 'bg-card border-border hover:border-muted-foreground/30 hover:bg-accent/30',
                    )}
                  >
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
                      selected ? et.iconBg : 'bg-muted',
                    )}>
                      <Icon className={cn('h-4 w-4', selected ? et.textColor : 'text-muted-foreground')} />
                    </div>
                    <div className="text-center">
                      <p className={cn('text-xs font-semibold', selected ? et.textColor : 'text-foreground')}>
                        {et.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{et.labelTh}</p>
                    </div>
                    {selected && (
                      <div className={cn('absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center', et.selectedBg)}>
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Date & Time ─── */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
              วันที่ และ เวลา
            </Label>

            {/* Date picker with presets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {DATE_PRESETS.map((preset) => {
                  const presetDate = format(preset.getValue(), 'yyyy-MM-dd');
                  const isActive = eventDate === presetDate;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => { setEventDate(presetDate); setCalendarOpen(false); }}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-accent/50 text-muted-foreground',
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs ml-auto">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(parsedDate, 'd MMM yyyy', { locale: th })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={parsedDate}
                      onSelect={(date) => {
                        if (date) {
                          setEventDate(format(date, 'yyyy-MM-dd'));
                          setCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Time inputs */}
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
              <div className="flex items-end gap-3">
                <TimeInput label="เวลาเริ่ม" value={startTime} onChange={setStartTime} />
                <div className="flex items-center pb-1.5">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                {hasEndTime ? (
                  <TimeInput label="เวลาสิ้นสุด" value={endTime} onChange={setEndTime} />
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">เวลาสิ้นสุด</Label>
                    <div className="h-10 flex items-center">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        กำลังดำเนินการ
                      </Badge>
                    </div>
                  </div>
                )}
                {/* Duration badge */}
                {durationMinutes && (
                  <div className="pb-1.5">
                    <Badge variant="outline" className="text-xs gap-1 whitespace-nowrap bg-background">
                      <Clock className="h-3 w-3" />
                      {durationMinutes >= 60
                        ? `${Math.floor(durationMinutes / 60)} ชม. ${durationMinutes % 60} น.`
                        : `${durationMinutes} นาที`
                      }
                    </Badge>
                  </div>
                )}
              </div>

              {/* Quick time presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground mr-1">เร็ว:</span>
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setStartTime(`${preset.value}:00`)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-mono rounded border transition-all',
                      startTime.startsWith(preset.value)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-background border-border hover:border-primary/30 text-muted-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <span className="mx-1 text-muted-foreground/40">|</span>
                <button
                  type="button"
                  onClick={() => setHasEndTime(!hasEndTime)}
                  className="px-2 py-0.5 text-[10px] rounded border border-border hover:border-primary/30 text-muted-foreground hover:text-primary transition-all"
                >
                  {hasEndTime ? 'ไม่ระบุเวลาสิ้นสุด' : 'ระบุเวลาสิ้นสุด'}
                </button>
              </div>
            </div>
          </div>

          {/* ─── Validation Warnings ─── */}
          {timeWarnings.length > 0 && (
            <div className="space-y-2">
              {timeWarnings.map((w, i) => (
                <Alert
                  key={i}
                  className={cn(
                    'py-2.5',
                    w.severity === 'error'
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                      : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
                  )}
                >
                  {w.type === 'holiday' ? (
                    <CalendarOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : w.type === 'break' ? (
                    <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : w.type === 'no_sku' ? (
                    <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : w.type === 'overlap' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <AlertDescription className={cn(
                    'text-xs',
                    w.severity === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
                  )}>
                    {w.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* ─── Product/SKU (for RUN) ─── */}
          {needsProduct && machineId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                <Package className="h-3.5 w-3.5" />
                สินค้า (SKU)
                {hasMachineStandards && (
                  <Badge variant="outline" className="text-[10px] ml-1 gap-0.5 font-normal">
                    <Check className="h-2.5 w-2.5" />
                    เฉพาะเครื่องนี้
                  </Badge>
                )}
              </Label>

              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground ml-2">กำลังโหลด SKU...</span>
                </div>
              ) : (
                <>
                  {/* Search */}
                  {displayProducts.length > 4 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="ค้นหาชื่อหรือรหัส SKU..."
                        value={skuSearch}
                        onChange={(e) => setSkuSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                  )}


                  {/* Product list */}
                  <ScrollArea className="h-[140px]">
                    {filteredProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Package className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {skuSearch ? 'ไม่พบ SKU ที่ค้นหา' : 'ไม่มี SKU สำหรับเครื่องนี้'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 pr-2">
                        {filteredProducts.map((product) => {
                          const isSelected = product.id === productId;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => setProductId(isSelected ? '' : product.id)}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                                isSelected
                                  ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                                  : 'border-transparent hover:bg-accent/30 hover:border-border',
                              )}
                            >
                              <div className={cn(
                                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                                isSelected ? 'bg-primary/10' : 'bg-muted',
                              )}>
                                <Package className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', isSelected && 'text-primary')}>
                                  {product.name}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          {/* ─── Product/SKU (for RUN) — prompt to select machine ─── */}
          {needsProduct && !machineId && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <span className="h-5 w-5 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">4</span>
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">สินค้า (SKU)</span>
              </Label>
              <div className="flex items-center justify-center py-4 rounded-lg border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">กรุณาเลือกเครื่องจักรก่อน</p>
              </div>
            </div>
          )}

          {/* ─── Reason (for DOWNTIME/SETUP) ─── */}
          {needsReason && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <span className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                สาเหตุ
              </Label>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="เลือกสาเหตุ..." />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                        {r.category}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ─── Notes ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="h-5 w-5 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                {needsProduct || needsReason ? '5' : '4'}
              </span>
              <span className="text-muted-foreground">หมายเหตุ</span>
              <span className="text-[10px] text-muted-foreground/60">(ไม่บังคับ)</span>
            </Label>
            <Textarea
              placeholder="รายละเอียดเพิ่มเติม..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
          {/* Summary */}
          {machineId && (
            <div className="flex-1 mr-auto">
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedMachine?.name}</span>
                <span>·</span>
                <span>{format(parsedDate, 'd MMM', { locale: th })}</span>
                <span>·</span>
                <span className="font-mono">{startTime.substring(0, 5)}</span>
                {hasEndTime && (
                  <>
                    <span>→</span>
                    <span className="font-mono">{endTime.substring(0, 5)}</span>
                  </>
                )}
                {selectedProduct && (
                  <>
                    <span>·</span>
                    <span>{selectedProduct.code}</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              ยกเลิก
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending} className="min-w-[120px]">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              สร้างเหตุการณ์
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
