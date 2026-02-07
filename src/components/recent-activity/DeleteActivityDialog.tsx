import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface DeleteActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  description?: string;
}

export function DeleteActivityDialog({ open, onOpenChange, entityType, entityId, description }: DeleteActivityDialogProps) {
  const queryClient = useQueryClient();

  const tableName = entityType === 'production_events' ? 'production_events' : 'production_counts';

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      toast.success('ลบรายการสำเร็จ');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message.includes('SHIFT_LOCKED')) {
        toast.error('ไม่สามารถลบได้ — กะถูกล็อกแล้ว');
      } else {
        toast.error(err.message);
      }
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
          <AlertDialogDescription>
            {description || 'คุณต้องการลบรายการนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            ลบ
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
