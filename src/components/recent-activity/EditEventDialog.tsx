import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Pause, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Convert an ISO/UTC timestamp string to a local datetime-local input value.
 */
function toLocalDatetimeString(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '--';
  const diffSec = Math.round((end.getTime() - start.getTime()) / 1000);
  if (diffSec < 0) return 'ไม่ถูกต้อง';
  if (diffSec < 60) return `${diffSec} วินาที`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return secs > 0 ? `${mins} นาที ${secs} วินาที` : `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} ชม. ${remMins} นาที` : `${hrs} ชม.`;
}

/** Parse "HH:MM:SS" or "HH:MM" into { h, m, s } */
function parseTime(timeStr: string): { h: number; m: number; s: number } {
  const parts = timeStr.split(':').map(Number);
  return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 };
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  initialData: {
    event_type: string;
    start_ts: string;
    end_ts: string | null;
    notes: string | null;
  };
  machineName?: string;
}

const EVENT_OPTIONS = [
  { value: 'RUN', label: 'Running', icon: Play, color: 'text-status-running', bg: 'bg-status-running/10' },
  { value: 'DOWNTIME', label: 'Downtime', icon: Pause, color: 'text-destructive', bg: 'bg-destructive/10' },
  { value: 'SETUP', label: 'Setup', icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
];

/** Editable time field with separate HH, MM, SS inputs */
function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const time = parseTime(value);

  const handleChange = useCallback((field: 'h' | 'm' | 's', raw: string) => {
    // Allow empty for typing, clamp on blur
    const num = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = field === 'h' ? Math.min(23, Math.max(0, num)) : Math.min(59, Math.max(0, num));
    const newTime = { ...time, [field]: clamped };
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${pad(newTime.h)}:${pad(newTime.m)}:${pad(newTime.s)}`);
  }, [time, onChange]);

  const inputClass = "w-14 h-10 text-center font-mono text-lg tabular-nums px-1 border rounded-md bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          className={inputClass}
          value={String(time.h).padStart(2, '0')}
          onChange={(e) => handleChange('h', e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="ชั่วโมง"
        />
        <span className="text-lg font-bold text-muted-foreground">:</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          className={inputClass}
          value={String(time.m).padStart(2, '0')}
          onChange={(e) => handleChange('m', e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="นาที"
        />
        <span className="text-lg font-bold text-muted-foreground">:</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          className={inputClass}
          value={String(time.s).padStart(2, '0')}
          onChange={(e) => handleChange('s', e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="วินาที"
        />
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>ชม.</span>
        <span className="ml-3">นาที</span>
        <span className="ml-2">วินาที</span>
      </div>
    </div>
  );
}

export function EditEventDialog({ open, onOpenChange, entityId, initialData, machineName }: EditEventDialogProps) {
  const queryClient = useQueryClient();

  const { data: liveEvent, isLoading: isLoadingEvent, error: fetchError } = useQuery({
    queryKey: ['editEvent', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_events')
        .select('event_type, start_ts, end_ts, notes')
        .eq('id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!entityId,
    staleTime: 0,
  });

  const resolvedData = useMemo(() => {
    if (liveEvent) {
      return {
        event_type: liveEvent.event_type,
        start_ts: liveEvent.start_ts,
        end_ts: liveEvent.end_ts,
        notes: liveEvent.notes,
      };
    }
    return initialData;
  }, [liveEvent, initialData]);

  const origStartLocal = useMemo(() => resolvedData.start_ts ? toLocalDatetimeString(resolvedData.start_ts) : '', [resolvedData.start_ts]);
  const origEndLocal = useMemo(() => resolvedData.end_ts ? toLocalDatetimeString(resolvedData.end_ts) : '', [resolvedData.end_ts]);

  const [eventType, setEventType] = useState(resolvedData.event_type);
  const [startTs, setStartTs] = useState(origStartLocal);
  const [endTs, setEndTs] = useState(origEndLocal);
  const [notes, setNotes] = useState(resolvedData.notes || '');
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    if (liveEvent) {
      const startLocal = liveEvent.start_ts ? toLocalDatetimeString(liveEvent.start_ts) : '';
      const endLocal = liveEvent.end_ts ? toLocalDatetimeString(liveEvent.end_ts) : '';
      setEventType(liveEvent.event_type);
      setStartTs(startLocal);
      setEndTs(endLocal);
      setNotes(liveEvent.notes || '');
      setFormReady(true);
    }
  }, [liveEvent]);

  useEffect(() => {
    if (!isLoadingEvent && !liveEvent && open && !fetchError) {
      toast.error('ไม่พบเหตุการณ์นี้ — อาจถูกลบหรือถูกแทนที่ไปแล้ว');
      onOpenChange(false);
    }
  }, [isLoadingEvent, liveEvent, open, fetchError, onOpenChange]);

  const hasTimeChanged = useMemo(() => {
    if (!formReady) return false;
    return startTs !== origStartLocal || endTs !== origEndLocal;
  }, [startTs, endTs, origStartLocal, origEndLocal, formReady]);

  // Helper to update time portion only
  const handleStartTimeChange = useCallback((timeStr: string) => {
    const datePart = startTs.split('T')[0];
    if (datePart) setStartTs(`${datePart}T${timeStr}`);
  }, [startTs]);

  const handleEndTimeChange = useCallback((timeStr: string) => {
    const datePart = endTs.split('T')[0] || startTs.split('T')[0];
    if (datePart) setEndTs(`${datePart}T${timeStr}`);
  }, [endTs, startTs]);

  // Duration display
  const durationText = useMemo(() => {
    if (!startTs || !endTs) return null;
    return formatDuration(startTs, endTs);
  }, [startTs, endTs]);

  const currentEventConfig = EVENT_OPTIONS.find(o => o.value === eventType);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rpc_update_event' as any, {
        p_event_id: entityId,
        p_event_type: eventType,
        p_start_ts: new Date(startTs).toISOString(),
        p_end_ts: endTs ? new Date(endTs).toISOString() : null,
        p_notes: notes || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error === 'SHIFT_LOCKED'
          ? 'SHIFT_LOCKED'
          : result?.error === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : result?.error === 'OVERLAP_EVENT'
          ? 'OVERLAP_EVENT'
          : result?.message || 'Unknown error');
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      const cascadedParts: string[] = [];
      if (result.cascaded_next) cascadedParts.push('event ถัดไป');
      if (result.cascaded_prev) cascadedParts.push('event ก่อนหน้า');
      if (cascadedParts.length > 0) {
        toast.success(`อัปเดตเหตุการณ์สำเร็จ — ปรับเวลา${cascadedParts.join('และ')}ให้ต่อเนื่องแล้ว`);
      } else {
        toast.success('อัปเดตเหตุการณ์สำเร็จ');
      }
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message.includes('SHIFT_LOCKED')) {
        toast.error('ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
      } else if (err.message.includes('OVERLAP_EVENT')) {
        toast.error('การเปลี่ยนเวลาทำให้เกิดเหตุการณ์ซ้อนทับกัน');
      } else if (err.message.includes('NOT_FOUND')) {
        toast.error('ไม่พบเหตุการณ์นี้ — อาจถูกลบหรือถูกแทนที่ไปแล้ว');
        onOpenChange(false);
      } else if (err.message.includes('PERMISSION_DENIED')) {
        toast.error('ไม่มีสิทธิ์แก้ไขเหตุการณ์นี้');
      } else {
        toast.error(err.message);
      }
    },
  });

  const handleSave = () => {
    if (hasTimeChanged) {
      setShowCascadeConfirm(true);
    } else {
      mutation.mutate();
    }
  };

  const handleConfirmCascade = () => {
    setShowCascadeConfirm(false);
    mutation.mutate();
  };

  const isFormLoading = isLoadingEvent || !formReady;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              แก้ไขเหตุการณ์การผลิต
            </DialogTitle>
            <DialogDescription>
              {machineName && `เครื่อง: ${machineName}`}
            </DialogDescription>
          </DialogHeader>

          {isFormLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {/* Event Type */}
                <div className="space-y-2">
                  <Label>ประเภทเหตุการณ์</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${opt.color}`} />
                              {opt.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Inputs */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    ช่วงเวลา
                    {hasTimeChanged && (
                      <Badge variant="outline" className="text-[10px] border-warning/50 text-warning ml-auto">
                        มีการเปลี่ยนแปลง
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <TimeInput
                      label="เวลาเริ่ม"
                      value={startTs.split('T')[1] || '00:00:00'}
                      onChange={handleStartTimeChange}
                    />
                    <TimeInput
                      label="เวลาสิ้นสุด"
                      value={endTs.split('T')[1] || '00:00:00'}
                      onChange={handleEndTimeChange}
                    />
                  </div>

                  {/* Duration preview */}
                  {durationText && (
                    <div className="flex items-center justify-center gap-2 pt-1 text-sm">
                      <span className="text-muted-foreground">ระยะเวลา:</span>
                      <span className="font-semibold">{durationText}</span>
                    </div>
                  )}
                </div>

                {hasTimeChanged && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>การเปลี่ยนเวลาจะปรับเวลาของ event ที่อยู่ถัดไปทั้งหมดในกะเดียวกันให้เลื่อนตามโดยอัตโนมัติ</span>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="หมายเหตุ (ไม่จำเป็น)"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
                <Button onClick={handleSave} disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  บันทึก
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCascadeConfirm} onOpenChange={setShowCascadeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              ยืนยันการเปลี่ยนเวลา
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>การเปลี่ยนเวลาของเหตุการณ์นี้จะส่งผลกระทบต่อเหตุการณ์ที่อยู่ถัดไปในกะเดียวกัน:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>เวลาสิ้นสุดของ event ก่อนหน้าจะถูกปรับให้ตรงกับเวลาเริ่มใหม่</li>
                <li>event ถัดไปทั้งหมดจะถูกเลื่อนเวลาตาม โดยคง duration เดิม</li>
              </ul>
              <p className="font-medium">ต้องการดำเนินการต่อหรือไม่?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCascade}>
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
