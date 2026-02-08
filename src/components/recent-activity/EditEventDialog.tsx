import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Pause, Wrench, AlertTriangle } from 'lucide-react';
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
import { toast } from 'sonner';

/**
 * Convert an ISO/UTC timestamp string to a local datetime-local input value.
 * e.g. "2026-02-07T15:14:02+00:00" → "2026-02-07T22:14:02" (for UTC+7)
 */
function toLocalDatetimeString(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
  { value: 'RUN', label: 'Running', icon: Play, color: 'text-status-running' },
  { value: 'DOWNTIME', label: 'Downtime', icon: Pause, color: 'text-destructive' },
  { value: 'SETUP', label: 'Setup', icon: Wrench, color: 'text-warning' },
];

export function EditEventDialog({ open, onOpenChange, entityId, initialData, machineName }: EditEventDialogProps) {
  const queryClient = useQueryClient();

  // Convert UTC timestamps to local timezone for display
  const origStartLocal = useMemo(() => initialData.start_ts ? toLocalDatetimeString(initialData.start_ts) : '', [initialData.start_ts]);
  const origEndLocal = useMemo(() => initialData.end_ts ? toLocalDatetimeString(initialData.end_ts) : '', [initialData.end_ts]);

  const [eventType, setEventType] = useState(initialData.event_type);
  const [startTs, setStartTs] = useState(origStartLocal);
  const [endTs, setEndTs] = useState(origEndLocal);
  const [notes, setNotes] = useState(initialData.notes || '');
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);

  // Detect if time fields have changed (comparing local timezone strings)
  const hasTimeChanged = useMemo(() => {
    return startTs !== origStartLocal || endTs !== origEndLocal;
  }, [startTs, endTs, origStartLocal, origEndLocal]);

  const mutation = useMutation({
    mutationFn: async () => {
      // new Date(localString) parses as local time, .toISOString() converts to UTC
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขเหตุการณ์การผลิต</DialogTitle>
            <DialogDescription>
              {machineName && `เครื่อง: ${machineName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>เวลาเริ่ม</Label>
                <Input
                  type="datetime-local"
                  value={startTs}
                  onChange={(e) => setStartTs(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>เวลาสิ้นสุด</Label>
                <Input
                  type="datetime-local"
                  value={endTs}
                  onChange={(e) => setEndTs(e.target.value)}
                />
              </div>
            </div>
            {hasTimeChanged && (
              <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>การเปลี่ยนเวลาจะปรับเวลาของ event ที่อยู่ติดกันให้ต่อเนื่องโดยอัตโนมัติ</span>
              </div>
            )}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
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
              <p>การเปลี่ยนเวลาของเหตุการณ์นี้จะส่งผลกระทบต่อเหตุการณ์ที่อยู่ติดกัน:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>เวลาสิ้นสุดของ event ก่อนหน้าจะถูกปรับให้ตรงกับเวลาเริ่มใหม่</li>
                <li>เวลาเริ่มของ event ถัดไปจะถูกปรับให้ตรงกับเวลาสิ้นสุดใหม่</li>
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
