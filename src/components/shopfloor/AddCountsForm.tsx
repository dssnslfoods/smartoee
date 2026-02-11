import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check, X, Delete, RotateCcw, Plus } from 'lucide-react';
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

type ActiveField = 'good' | 'reject';

const QUICK_ADD_VALUES = [10, 50, 100, 500];

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
  const [activeField, setActiveField] = useState<ActiveField>('good');
  const [inputBuffer, setInputBuffer] = useState('0');
  const [isEditing, setIsEditing] = useState(false);

  const currentValue = activeField === 'good' ? goodQty : rejectQty;
  const setCurrentValue = activeField === 'good' ? setGoodQty : setRejectQty;

  const syncBufferToField = useCallback((buffer: string) => {
    const num = parseInt(buffer) || 0;
    setCurrentValue(Math.max(0, num));
  }, [setCurrentValue]);

  const goodInputRef = useRef<HTMLInputElement>(null);
  const rejectInputRef = useRef<HTMLInputElement>(null);

  const handleFieldSelect = (field: ActiveField) => {
    setActiveField(field);
    const val = field === 'good' ? goodQty : rejectQty;
    setInputBuffer(val.toString());
    // Focus the input after selecting
    setTimeout(() => {
      const ref = field === 'good' ? goodInputRef : rejectInputRef;
      ref.current?.focus();
      ref.current?.select();
    }, 0);
  };

  const handleDirectInput = (field: ActiveField, raw: string) => {
    if (isLocked) return;
    // Allow empty string while typing
    const cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.length > 6) return;
    const setter = field === 'good' ? setGoodQty : setRejectQty;
    if (field === activeField) {
      setInputBuffer(cleaned || '0');
    }
    setter(parseInt(cleaned) || 0);
  };

  const handleNumpadPress = (digit: string) => {
    if (isLocked) return;
    const newBuffer = inputBuffer === '0' ? digit : inputBuffer + digit;
    // Limit to 6 digits
    if (newBuffer.length > 6) return;
    setInputBuffer(newBuffer);
    syncBufferToField(newBuffer);
  };

  const handleBackspace = () => {
    if (isLocked) return;
    const newBuffer = inputBuffer.length > 1 ? inputBuffer.slice(0, -1) : '0';
    setInputBuffer(newBuffer);
    syncBufferToField(newBuffer);
  };

  const handleClear = () => {
    if (isLocked) return;
    setInputBuffer('0');
    setCurrentValue(0);
  };

  const handleQuickAdd = (amount: number) => {
    if (isLocked) return;
    const newVal = currentValue + amount;
    setCurrentValue(newVal);
    setInputBuffer(newVal.toString());
  };

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
    setInputBuffer('0');
    setActiveField('good');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Quantity Display Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Good Quantity Card */}
        <div
          onClick={() => handleFieldSelect('good')}
          className={cn(
            'relative rounded-xl border-2 p-4 text-left transition-all cursor-pointer',
            activeField === 'good'
              ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/10'
              : 'border-border bg-card hover:border-green-500/50',
            isLocked && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              activeField === 'good' ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-500'
            )}>
              <Check className="h-4 w-4" />
            </div>
            <Label className="text-sm font-medium text-muted-foreground">ชิ้นงานดี</Label>
          </div>
          <input
            ref={goodInputRef}
            type="text"
            inputMode="numeric"
            value={activeField === 'good' ? inputBuffer : goodQty.toString()}
            onChange={(e) => handleDirectInput('good', e.target.value)}
            onFocus={() => { setActiveField('good'); setInputBuffer(goodQty.toString()); }}
            className={cn(
              'w-full text-3xl font-bold tabular-nums tracking-tight bg-transparent border-none outline-none p-0',
              goodQty > 0 ? 'text-green-500' : 'text-muted-foreground'
            )}
            disabled={isLocked}
            maxLength={6}
          />
          {activeField === 'good' && (
            <div className="absolute top-2 right-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Reject Quantity Card */}
        <div
          onClick={() => handleFieldSelect('reject')}
          className={cn(
            'relative rounded-xl border-2 p-4 text-left transition-all cursor-pointer',
            activeField === 'reject'
              ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/10'
              : 'border-border bg-card hover:border-red-500/50',
            isLocked && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full',
              activeField === 'reject' ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-500'
            )}>
              <X className="h-4 w-4" />
            </div>
            <Label className="text-sm font-medium text-muted-foreground">ของเสีย</Label>
          </div>
          <input
            ref={rejectInputRef}
            type="text"
            inputMode="numeric"
            value={activeField === 'reject' ? inputBuffer : rejectQty.toString()}
            onChange={(e) => handleDirectInput('reject', e.target.value)}
            onFocus={() => { setActiveField('reject'); setInputBuffer(rejectQty.toString()); }}
            className={cn(
              'w-full text-3xl font-bold tabular-nums tracking-tight bg-transparent border-none outline-none p-0',
              rejectQty > 0 ? 'text-red-500' : 'text-muted-foreground'
            )}
            disabled={isLocked}
            maxLength={6}
          />
          {activeField === 'reject' && (
            <div className="absolute top-2 right-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex gap-2">
        {QUICK_ADD_VALUES.map((val) => (
          <Button
            key={val}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'flex-1 h-10 text-sm font-semibold',
              activeField === 'good'
                ? 'hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-500'
                : 'hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500'
            )}
            onClick={() => handleQuickAdd(val)}
            disabled={isLocked}
          >
            +{val}
          </Button>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            className="h-14 text-xl font-bold hover:bg-accent"
            onClick={() => handleNumpadPress(digit.toString())}
            disabled={isLocked}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-14 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
          onClick={handleClear}
          disabled={isLocked}
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 text-xl font-bold hover:bg-accent"
          onClick={() => handleNumpadPress('0')}
          disabled={isLocked}
        >
          0
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 text-muted-foreground hover:bg-accent"
          onClick={handleBackspace}
          disabled={isLocked}
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>

      {/* Defect Reason (required if reject > 0) */}
      {rejectQty > 0 && (
        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <Label className="text-sm font-medium text-red-400">สาเหตุของเสีย *</Label>
          <Select value={defectReasonId} onValueChange={setDefectReasonId}>
            <SelectTrigger className="border-red-500/30">
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

      {/* Total Summary + Submit */}
      <div className="rounded-xl border bg-muted/30 p-3">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-muted-foreground">รวมจำนวนผลิต</span>
          <span className="text-lg font-bold tabular-nums">
            {(goodQty + rejectQty).toLocaleString()} ชิ้น
          </span>
        </div>
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
          บันทึกจำนวน
        </Button>
      </div>
    </form>
  );
}
