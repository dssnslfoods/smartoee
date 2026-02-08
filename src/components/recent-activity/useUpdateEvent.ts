import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateEventParams {
  eventId: string;
  eventType: string;
  startTs: string;  // ISO string
  endTs: string | null;
  notes: string | null;
}

export function useUpdateEvent(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateEventParams) => {
      const { data, error } = await supabase.rpc('rpc_update_event' as any, {
        p_event_id: params.eventId,
        p_event_type: params.eventType,
        p_start_ts: params.startTs,
        p_end_ts: params.endTs,
        p_notes: params.notes,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(
          result?.error === 'SHIFT_LOCKED' ? 'SHIFT_LOCKED'
          : result?.error === 'NOT_FOUND' ? 'NOT_FOUND'
          : result?.error === 'OVERLAP_EVENT' ? 'OVERLAP_EVENT'
          : result?.message || 'Unknown error'
        );
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
      const cascadedParts: string[] = [];
      if (result.cascaded_next) cascadedParts.push('event ถัดไป');
      if (result.cascaded_prev) cascadedParts.push('event ก่อนหน้า');
      if (cascadedParts.length > 0) {
        toast.success(`อัปเดตสำเร็จ — ปรับเวลา${cascadedParts.join('และ')}ให้ต่อเนื่องแล้ว`);
      } else {
        toast.success('อัปเดตเหตุการณ์สำเร็จ');
      }
      onSuccess?.();
    },
    onError: (err: Error) => {
      if (err.message.includes('SHIFT_LOCKED')) {
        toast.error('ไม่สามารถแก้ไขได้ — กะถูกล็อกแล้ว');
      } else if (err.message.includes('OVERLAP_EVENT')) {
        toast.error('การเปลี่ยนเวลาทำให้เกิดเหตุการณ์ซ้อนทับกัน');
      } else if (err.message.includes('NOT_FOUND')) {
        toast.error('ไม่พบเหตุการณ์นี้ — อาจถูกลบไปแล้ว');
      } else if (err.message.includes('PERMISSION_DENIED')) {
        toast.error('ไม่มีสิทธิ์แก้ไขเหตุการณ์นี้');
      } else {
        toast.error(err.message);
      }
    },
  });
}
