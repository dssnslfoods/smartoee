import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Play, Pause, Wrench, Package, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineTimeInput } from './InlineTimeInput';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface CreateManualEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
}

const EVENT_TYPES = [
  { value: 'RUN', label: 'Running', icon: Play, color: 'text-status-running' },
  { value: 'DOWNTIME', label: 'Downtime', icon: Pause, color: 'text-destructive' },
  { value: 'SETUP', label: 'Setup', icon: Wrench, color: 'text-warning' },
] as const;

export function CreateManualEventDialog({ open, onOpenChange, companyId }: CreateManualEventDialogProps) {
  const queryClient = useQueryClient();

  const [machineId, setMachineId] = useState('');
  const [eventType, setEventType] = useState<string>('RUN');
  const [startTime, setStartTime] = useState('08:00:00');
  const [endTime, setEndTime] = useState('09:00:00');
  const [hasEndTime, setHasEndTime] = useState(true);
  const [productId, setProductId] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch machines
  const { data: machines = [] } = useQuery({
    queryKey: ['manual-event-machines', companyId],
    queryFn: async () => {
      // Get permitted machine IDs
      const { data: permittedIds } = await supabase.rpc('get_user_permitted_machine_ids');
      if (!permittedIds || permittedIds.length === 0) return [];

      const { data, error } = await supabase
        .from('machines')
        .select('id, name, code')
        .eq('is_active', true)
        .in('id', permittedIds)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['manual-event-products', companyId],
    queryFn: async () => {
      let q = supabase.from('products').select('id, name, code').eq('is_active', true);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && eventType === 'RUN',
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

  const needsReason = eventType === 'DOWNTIME' || eventType === 'SETUP';
  const needsProduct = eventType === 'RUN';

  const isValid = useMemo(() => {
    if (!machineId) return false;
    if (!eventType) return false;
    if (!startTime) return false;
    if (hasEndTime && !endTime) return false;
    if (needsReason && !reasonId) return false;
    return true;
  }, [machineId, eventType, startTime, endTime, hasEndTime, needsReason, reasonId]);

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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างเหตุการณ์ Manual</DialogTitle>
          <DialogDescription>
            เพิ่มเหตุการณ์การผลิตย้อนหลังด้วยเวลาที่กำหนดเอง
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Machine */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">เครื่องจักร *</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกเครื่องจักร" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">ประเภทเหตุการณ์ *</Label>
            <div className="flex gap-2">
              {EVENT_TYPES.map((et) => {
                const Icon = et.icon;
                const selected = eventType === et.value;
                return (
                  <Button
                    key={et.value}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      setEventType(et.value);
                      if (et.value === 'RUN') { setReasonId(''); }
                      else { setProductId(''); }
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {et.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">วันที่ *</Label>
            <input
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          {/* Start / End time */}
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">เวลาเริ่ม *</Label>
              <InlineTimeInput value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-sm font-medium">เวลาสิ้นสุด</Label>
                <button
                  type="button"
                  className="text-[10px] text-primary underline"
                  onClick={() => setHasEndTime(!hasEndTime)}
                >
                  {hasEndTime ? 'ไม่ระบุ' : 'ระบุเวลา'}
                </button>
              </div>
              {hasEndTime ? (
                <InlineTimeInput value={endTime} onChange={setEndTime} />
              ) : (
                <span className="text-sm text-muted-foreground font-mono">กำลังดำเนินการ</span>
              )}
            </div>
          </div>

          {/* Product (for RUN) */}
          {needsProduct && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> สินค้า (SKU)
              </Label>
              <Select value={productId || 'none'} onValueChange={(v) => setProductId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสินค้า (ถ้ามี)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reason (for DOWNTIME/SETUP) */}
          {needsReason && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">สาเหตุ *</Label>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาเหตุ" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Textarea
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            สร้างเหตุการณ์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
