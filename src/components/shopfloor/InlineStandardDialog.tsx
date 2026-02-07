import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Timer, Wrench, Gauge, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Product, Machine } from '@/services/types';

interface InlineStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine;
  product: Product;
  companyId: string;
  onCreated?: () => void;
}

export function InlineStandardDialog({
  open,
  onOpenChange,
  machine,
  product,
  companyId,
  onCreated,
}: InlineStandardDialogProps) {
  const queryClient = useQueryClient();

  const [cycleTime, setCycleTime] = useState<number>(machine.ideal_cycle_time_seconds);
  const [setupTime, setSetupTime] = useState<number>(0);
  const [targetQuality, setTargetQuality] = useState<number>(99);

  // Warn if SKU cycle time is faster than machine capacity
  const cycleTimeWarning = cycleTime < machine.ideal_cycle_time_seconds
    ? `SKU speed (${cycleTime}s) เร็วกว่า Machine capacity (${machine.ideal_cycle_time_seconds}s)`
    : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('production_standards').insert({
        machine_id: machine.id,
        product_id: product.id,
        company_id: companyId,
        ideal_cycle_time_seconds: cycleTime,
        std_setup_time_seconds: setupTime,
        target_quality: targetQuality,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machineStandards', machine.id] });
      queryClient.invalidateQueries({ queryKey: ['productionStandard', machine.id, product.id] });
      queryClient.invalidateQueries({ queryKey: ['production-standards'] });
      toast.success(`ตั้งค่ามาตรฐานสำหรับ ${product.code} บน ${machine.name} สำเร็จ`);
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error: Error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        toast.error('Machine + SKU combination already exists');
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleSubmit = () => {
    if (cycleTime <= 0) {
      toast.error('Cycle Time ต้องมากกว่า 0');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ตั้งค่ามาตรฐานการผลิต</DialogTitle>
          <DialogDescription>
            กำหนด benchmark สำหรับ <strong>{product.name}</strong> ({product.code}) บนเครื่อง <strong>{machine.name}</strong> ({machine.code})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Benchmarks */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Cycle Time (s)
                </Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={cycleTime}
                  onChange={(e) => setCycleTime(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  Setup Time (s)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={setupTime}
                  onChange={(e) => setSetupTime(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  Quality (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={targetQuality}
                  onChange={(e) => setTargetQuality(parseFloat(e.target.value) || 99)}
                />
              </div>
            </div>

            {cycleTimeWarning && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{cycleTimeWarning}</AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Machine Default CT: {machine.ideal_cycle_time_seconds}s
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
