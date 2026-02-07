import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface EditCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  initialData: {
    good_qty: number;
    reject_qty: number;
    notes: string | null;
  };
  machineName?: string;
}

export function EditCountDialog({ open, onOpenChange, entityId, initialData, machineName }: EditCountDialogProps) {
  const queryClient = useQueryClient();
  const [goodQty, setGoodQty] = useState(initialData.good_qty);
  const [rejectQty, setRejectQty] = useState(initialData.reject_qty);
  const [notes, setNotes] = useState(initialData.notes || '');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('production_counts')
        .update({
          good_qty: goodQty,
          reject_qty: rejectQty,
          notes: notes || null,
        })
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      toast.success('อัปเดตจำนวนผลิตสำเร็จ');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขจำนวนผลิต</DialogTitle>
          <DialogDescription>
            {machineName && `เครื่อง: ${machineName}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>จำนวนดี (Good)</Label>
              <Input
                type="number"
                min="0"
                value={goodQty}
                onChange={(e) => setGoodQty(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>จำนวนเสีย (Reject)</Label>
              <Input
                type="number"
                min="0"
                value={rejectQty}
                onChange={(e) => setRejectQty(parseInt(e.target.value) || 0)}
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
