import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock, AlertTriangle } from 'lucide-react';

export function LockedBanner() {
  return (
    <Alert variant="destructive" className="border-2">
      <Lock className="h-5 w-5" />
      <AlertTitle className="flex items-center gap-2 text-lg">
        <AlertTriangle className="h-5 w-5" />
        กะนี้ถูกล็อคแล้ว
      </AlertTitle>
      <AlertDescription className="mt-2">
        ไม่สามารถเพิ่มหรือแก้ไขข้อมูลได้ กรุณาติดต่อ Supervisor หากต้องการแก้ไข
      </AlertDescription>
    </Alert>
  );
}
