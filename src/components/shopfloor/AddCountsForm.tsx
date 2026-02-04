import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Minus, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefectReason } from '@/services/types';

interface AddCountsFormProps {
  defectReasons: DefectReason[];
  onSubmit: (data: {
    goodQty: number;
    rejectQty: number;
    defectReasonId?: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
  isLocked?: boolean;
}

export function AddCountsForm({
  defectReasons,
  onSubmit,
  isLoading = false,
  isLocked = false,
}: AddCountsFormProps) {
  const [goodQty, setGoodQty] = useState(0);
  const [rejectQty, setRejectQty] = useState(0);
  const [defectReasonId, setDefectReasonId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goodQty === 0 && rejectQty === 0) return;
    
    onSubmit({
      goodQty,
      rejectQty,
      defectReasonId: defectReasonId || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setGoodQty(0);
    setRejectQty(0);
    setDefectReasonId('');
    setNotes('');
  };

  const incrementGood = () => setGoodQty(prev => prev + 1);
  const decrementGood = () => setGoodQty(prev => Math.max(0, prev - 1));
  const incrementReject = () => setRejectQty(prev => prev + 1);
  const decrementReject = () => setRejectQty(prev => Math.max(0, prev - 1));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Good Quantity */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-green-600" />
            ชิ้นงานดี
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={decrementGood}
              disabled={isLocked || goodQty === 0}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              type="number"
              value={goodQty}
              onChange={(e) => setGoodQty(Math.max(0, parseInt(e.target.value) || 0))}
              className={cn(
                'h-12 text-center text-xl font-bold',
                goodQty > 0 && 'text-green-600 border-green-300'
              )}
              min={0}
              disabled={isLocked}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 hover:bg-green-50 hover:border-green-300"
              onClick={incrementGood}
              disabled={isLocked}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Reject Quantity */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <X className="h-4 w-4 text-red-600" />
            ของเสีย
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={decrementReject}
              disabled={isLocked || rejectQty === 0}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              type="number"
              value={rejectQty}
              onChange={(e) => setRejectQty(Math.max(0, parseInt(e.target.value) || 0))}
              className={cn(
                'h-12 text-center text-xl font-bold',
                rejectQty > 0 && 'text-red-600 border-red-300'
              )}
              min={0}
              disabled={isLocked}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 hover:bg-red-50 hover:border-red-300"
              onClick={incrementReject}
              disabled={isLocked}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Defect Reason (required if reject > 0) */}
      {rejectQty > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">สาเหตุของเสีย *</Label>
          <Select value={defectReasonId} onValueChange={setDefectReasonId}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกสาเหตุ" />
            </SelectTrigger>
            <SelectContent>
              {defectReasons.map((reason) => (
                <SelectItem key={reason.id} value={reason.id}>
                  {reason.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">หมายเหตุ</Label>
        <Textarea
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none"
          rows={2}
          disabled={isLocked}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 text-base font-medium"
        disabled={
          isLoading || 
          isLocked || 
          (goodQty === 0 && rejectQty === 0) ||
          (rejectQty > 0 && !defectReasonId)
        }
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : (
          <Plus className="h-5 w-5 mr-2" />
        )}
        บันทึกจำนวน ({goodQty + rejectQty} ชิ้น)
      </Button>
    </form>
  );
}
