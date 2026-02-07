import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Pause, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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

export function EditEventDialog({ open, onOpenChange, entityId, initialData, machineName }: EditEventDialogProps) {
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState(initialData.event_type);
  const [startTs, setStartTs] = useState(initialData.start_ts ? initialData.start_ts.slice(0, 19) : '');
  const [endTs, setEndTs] = useState(initialData.end_ts ? initialData.end_ts.slice(0, 19) : '');
  const [notes, setNotes] = useState(initialData.notes || '');

  const mutation = useMutation({
    mutationFn: async () => {
      const updateData: Record<string, unknown> = {
        event_type: eventType,
        start_ts: new Date(startTs).toISOString(),
        notes: notes || null,
      };
      if (endTs) {
        updateData.end_ts = new Date(endTs).toISOString();
      }
      const { error } = await supabase
        .from('production_events')
        .update(updateData)
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      toast.success('อัปเดตเหตุการณ์สำเร็จ');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message.includes('SHIFT_LOCKED')) {
        toast.error('ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
      } else {
        toast.error(err.message);
      }
    },
  });

  const EVENT_OPTIONS = [
    { value: 'RUN', label: 'Running', icon: Play, color: 'text-status-running' },
    { value: 'DOWNTIME', label: 'Downtime', icon: Pause, color: 'text-destructive' },
    { value: 'SETUP', label: 'Setup', icon: Wrench, color: 'text-warning' },
  ];

  return (
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
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
