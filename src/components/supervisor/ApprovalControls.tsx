import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Lock, AlertTriangle, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RecalcPreviewDialog } from './RecalcPreviewDialog';
import { supabase } from '@/integrations/supabase/client';

interface ApprovalControlsProps {
  shiftCalendarId: string;
  status: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  onApprove: () => void;
  onLock: () => void;
  onRecalc: () => void;
  isApproving: boolean;
  isLocking: boolean;
  isRecalculating: boolean;
}

export function ApprovalControls({
  shiftCalendarId,
  status,
  approvedBy,
  approvedAt,
  lockedBy,
  lockedAt,
  onApprove,
  onLock,
  onRecalc,
  isApproving,
  isLocking,
  isRecalculating,
}: ApprovalControlsProps) {
  const isLocked = status === 'LOCKED';
  const isApproved = status === 'APPROVED';
  const isDraft = !status || status === 'DRAFT';

  // Check for pending counts: RUN events with end_ts that have no matching production_counts
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['shift-pending-counts', shiftCalendarId],
    queryFn: async () => {
      // Get all completed RUN events for this shift
      const { data: runEvents } = await supabase
        .from('production_events')
        .select('id, machine_id')
        .eq('shift_calendar_id', shiftCalendarId)
        .eq('event_type', 'RUN')
        .not('end_ts', 'is', null);

      if (!runEvents?.length) return 0;

      const machineIds = [...new Set(runEvents.map(e => e.machine_id))];

      // Get production counts for this shift
      const { data: counts } = await supabase
        .from('production_counts')
        .select('machine_id')
        .eq('shift_calendar_id', shiftCalendarId)
        .in('machine_id', machineIds);

      const machinesWithCounts = new Set((counts || []).map(c => c.machine_id));
      
      // Count events for machines that have no counts
      return runEvents.filter(e => !machinesWithCounts.has(e.machine_id)).length;
    },
    enabled: !isLocked, // No need to check if already locked
    staleTime: 15_000,
  });

  const hasPendingCounts = pendingCount > 0;

  return (
    <div className="flex flex-col gap-4 pt-5 border-t border-border/60">
      {/* Pending counts warning */}
      {hasPendingCounts && !isLocked && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <ClipboardList className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-600">
              มี {pendingCount} เหตุการณ์ RUN ที่ยังไม่ได้บันทึกจำนวนผลิต
            </p>
            <p className="text-xs text-muted-foreground">
              ต้องบันทึกจำนวนผลิตให้ครบก่อนจึงจะอนุมัติหรือล็อคกะได้
            </p>
          </div>
        </div>
      )}

      {/* Status Info */}
      <div className="flex flex-wrap gap-4 text-sm">
        {isApproved && approvedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-status-running" />
            <span>อนุมัติเมื่อ: {format(new Date(approvedAt), 'd MMM yyyy HH:mm', { locale: th })}</span>
          </div>
        )}
        {isLocked && lockedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4 text-status-idle" />
            <span>ล็อคเมื่อ: {format(new Date(lockedAt), 'd MMM yyyy HH:mm', { locale: th })}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Recalculate OEE Button - with preview dialog */}
        {!isLocked && (
          <RecalcPreviewDialog
            shiftCalendarId={shiftCalendarId}
            onRecalc={onRecalc}
            isRecalculating={isRecalculating}
          />
        )}

        {/* Approve Button */}
        {isDraft && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="bg-status-running hover:bg-status-running/90 min-w-[120px]"
                disabled={isApproving || hasPendingCounts}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติกะ'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>อนุมัติกะ?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  การอนุมัติหมายถึงข้อมูลในกะนี้ถูกต้องและพร้อมสำหรับการปิดกะ
                  พนักงานยังสามารถแก้ไขข้อมูลได้จนกว่าจะมีการล็อค
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onApprove} 
                  className="bg-status-running hover:bg-status-running/90"
                >
                  อนุมัติ
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Lock Button */}
        {isApproved && !isLocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="bg-status-idle hover:bg-status-idle/90 min-w-[120px]"
                disabled={isLocking || hasPendingCounts}
              >
                {isLocking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {isLocking ? 'กำลังล็อค...' : 'ล็อคกะ'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-status-idle" />
                  ยืนยันการล็อคกะ?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-sm">
                  <p>
                    <strong className="text-foreground">คำเตือน:</strong> หลังจากล็อคกะแล้ว 
                    จะไม่สามารถแก้ไขข้อมูลใดๆ ในกะนี้ได้อีก รวมถึง:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>เพิ่ม/แก้ไข Production Events</li>
                    <li>เพิ่ม/แก้ไข Production Counts</li>
                    <li>คำนวณ OEE ใหม่</li>
                  </ul>
                  <p className="font-medium text-foreground">
                    กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนดำเนินการ
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onLock} 
                  className="bg-status-idle hover:bg-status-idle/90"
                >
                  ยืนยันล็อค
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Locked State */}
        {isLocked && (
          <div className="flex items-center gap-2 text-status-idle bg-status-idle/10 px-4 py-2.5 rounded-lg">
            <Lock className="h-4 w-4" />
            <span className="font-medium text-sm">กะนี้ถูกล็อคแล้ว - ไม่สามารถแก้ไขได้</span>
          </div>
        )}
      </div>
    </div>
  );
}
