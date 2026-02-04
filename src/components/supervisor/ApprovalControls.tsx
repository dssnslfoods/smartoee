import { useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, Lock, Calculator, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="flex flex-col gap-4 pt-4 border-t">
      {/* Status Info */}
      {isApproved && approvedAt && (
        <div className="text-sm text-muted-foreground">
          อนุมัติเมื่อ: {format(new Date(approvedAt), 'd MMM yyyy HH:mm', { locale: th })}
        </div>
      )}
      {isLocked && lockedAt && (
        <div className="text-sm text-muted-foreground">
          ล็อคเมื่อ: {format(new Date(lockedAt), 'd MMM yyyy HH:mm', { locale: th })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Recalculate OEE Button */}
        {!isLocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isRecalculating}>
                <Calculator className="h-4 w-4 mr-2" />
                {isRecalculating ? 'กำลังคำนวณ...' : 'คำนวณ OEE ใหม่'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>คำนวณ OEE ใหม่?</AlertDialogTitle>
                <AlertDialogDescription>
                  ระบบจะคำนวณ OEE ใหม่สำหรับเครื่องจักรทั้งหมดในกะนี้ 
                  ข้อมูล OEE เดิมจะถูกแทนที่ด้วยค่าใหม่
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={onRecalc}>
                  คำนวณใหม่
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Approve Button */}
        {isDraft && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" className="bg-green-600 hover:bg-green-700" disabled={isApproving}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติกะ'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>อนุมัติกะ?</AlertDialogTitle>
                <AlertDialogDescription>
                  การอนุมัติหมายถึงข้อมูลในกะนี้ถูกต้องและพร้อมสำหรับการปิดกะ
                  พนักงานยังสามารถแก้ไขข้อมูลได้จนกว่าจะมีการล็อค
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={onApprove} className="bg-green-600 hover:bg-green-700">
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
              <Button variant="default" className="bg-orange-600 hover:bg-orange-700" disabled={isLocking}>
                <Lock className="h-4 w-4 mr-2" />
                {isLocking ? 'กำลังล็อค...' : 'ล็อคกะ'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  ยืนยันการล็อคกะ?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    <strong className="text-foreground">คำเตือน:</strong> หลังจากล็อคกะแล้ว 
                    จะไม่สามารถแก้ไขข้อมูลใดๆ ในกะนี้ได้อีก รวมถึง:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
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
                <AlertDialogAction onClick={onLock} className="bg-orange-600 hover:bg-orange-700">
                  ยืนยันล็อค
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Locked State */}
        {isLocked && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 dark:bg-orange-950 px-4 py-2 rounded-md">
            <Lock className="h-4 w-4" />
            <span className="font-medium">กะนี้ถูกล็อคแล้ว - ไม่สามารถแก้ไขได้</span>
          </div>
        )}
      </div>
    </div>
  );
}
