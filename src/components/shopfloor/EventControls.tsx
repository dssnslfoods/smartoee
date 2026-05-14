import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Play, Pause, StopCircle, Wrench, Loader2, Clock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import type { ProductionEvent, DowntimeReason, Product, SetupReason } from '@/services/types';

interface EventControlsProps {
  currentEvent: ProductionEvent | null | undefined;
  downtimeReasons: DowntimeReason[];
  setupReasons: SetupReason[];
  selectedProduct: Product | null;
  machineCycleTime?: number;
  effectiveCycleTime?: number;
  cycleTimeSource?: string;
  noBenchmarkWarning?: string | null;
  onStartRun: () => void;
  onStartDowntime: (reasonId: string, notes?: string, stdSetupTimeSeconds?: number | null) => void;
  onStartSetup: (reasonId: string, notes?: string, stdSetupTimeSeconds?: number | null) => void;
  onStop: (notes?: string) => void;
  isLoading?: boolean;
  isLocked?: boolean;
  defaultStdSetupTimeSeconds?: number;
}

export function EventControls({
  currentEvent,
  downtimeReasons,
  setupReasons,
  selectedProduct,
  machineCycleTime,
  effectiveCycleTime: propEffectiveCycleTime,
  cycleTimeSource: propCycleTimeSource,
  noBenchmarkWarning,
  onStartRun,
  onStartDowntime,
  onStartSetup,
  onStop,
  isLoading = false,
  isLocked = false,
  defaultStdSetupTimeSeconds = 0,
}: EventControlsProps) {
  // Use passed-in effective values, fallback to machine default only
  const effectiveCycleTime = propEffectiveCycleTime ?? machineCycleTime;
  const cycleTimeSource = propCycleTimeSource ?? 'Machine Default';
  const [showDowntimeDialog, setShowDowntimeDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [notes, setNotes] = useState('');
  // เวลามาตรฐานเป็น "นาที" — ผู้ใช้กรอกง่ายกว่า เก็บลง DB เป็นวินาที
  const [stdSetupMinutes, setStdSetupMinutes] = useState<string>('');

  const selectedReason = downtimeReasons.find(r => r.id === selectedReasonId);
  const isChangeoverReason = selectedReason?.category === 'CHANGEOVER';

  // Pre-fill std จากค่า default (production_standards) เมื่อ user เปิด dialog หรือเลือก reason CHANGEOVER
  useEffect(() => {
    if ((showSetupDialog || (showDowntimeDialog && isChangeoverReason)) && defaultStdSetupTimeSeconds > 0) {
      setStdSetupMinutes((defaultStdSetupTimeSeconds / 60).toString());
    }
  }, [showSetupDialog, showDowntimeDialog, isChangeoverReason, defaultStdSetupTimeSeconds]);

  const parseStdSetupSeconds = (): number | null => {
    const minutes = parseFloat(stdSetupMinutes);
    if (isNaN(minutes) || minutes <= 0) return null;
    return Math.round(minutes * 60);
  };

  const handleDowntimeSubmit = () => {
    if (selectedReasonId) {
      const std = isChangeoverReason ? parseStdSetupSeconds() : null;
      onStartDowntime(selectedReasonId, notes || undefined, std);
      setShowDowntimeDialog(false);
      setSelectedReasonId('');
      setNotes('');
      setStdSetupMinutes('');
    }
  };

  const handleSetupSubmit = () => {
    if (selectedReasonId) {
      const std = parseStdSetupSeconds();
      onStartSetup(selectedReasonId, notes || undefined, std);
      setShowSetupDialog(false);
      setSelectedReasonId('');
      setNotes('');
      setStdSetupMinutes('');
    }
  };

  const handleStopSubmit = () => {
    onStop(notes || undefined);
    setShowStopDialog(false);
    setNotes('');
  };

  const eventTypeConfig = {
    RUN: { color: 'bg-green-500', icon: Play, label: 'Running' },
    DOWNTIME: { color: 'bg-red-500', icon: Pause, label: 'Downtime' },
    SETUP: { color: 'bg-yellow-500', icon: Wrench, label: 'Setup' },
  };

  const downtimeCategories = {
    PLANNED: downtimeReasons.filter(r => r.category === 'PLANNED'),
    UNPLANNED: downtimeReasons.filter(r => r.category === 'UNPLANNED'),
    BREAKDOWN: downtimeReasons.filter(r => r.category === 'BREAKDOWN'),
    CHANGEOVER: downtimeReasons.filter(r => r.category === 'CHANGEOVER'),
  };

  return (
    <div className="space-y-4">
      {/* Current Status */}
      {currentEvent && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 rounded-full animate-pulse',
                eventTypeConfig[currentEvent.event_type].color
              )} />
              <span className="font-medium">
                {eventTypeConfig[currentEvent.event_type].label}
              </span>
              {/* SKU Info Badge */}
              {currentEvent.event_type === 'RUN' && currentEvent.product && (
                <Badge variant="secondary" className="text-xs gap-1">
                  {currentEvent.product.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {/* Cycle Time badge - shows source (SKU or Machine Default) */}
              {currentEvent.event_type === 'RUN' && effectiveCycleTime && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Timer className="h-3 w-3" />
                  Target: {effectiveCycleTime}s [{cycleTimeSource}]
                </Badge>
              )}
              <Clock className="h-4 w-4" />
              <span>
                {formatDistanceToNow(new Date(currentEvent.start_ts), { 
                  locale: th, 
                  addSuffix: false 
                })}
              </span>
            </div>
          </div>
          {currentEvent.reason && (
            <Badge variant="outline" className="text-xs">
              {currentEvent.reason.name}
            </Badge>
          )}
          {currentEvent.notes && (
            <p className="text-sm text-muted-foreground">{currentEvent.notes}</p>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          variant={currentEvent?.event_type === 'RUN' ? 'default' : 'outline'}
          className={cn(
            'h-16 text-base font-medium',
            currentEvent?.event_type === 'RUN' && 'bg-green-600 hover:bg-green-700'
          )}
          onClick={onStartRun}
          disabled={isLoading || isLocked || currentEvent?.event_type === 'RUN'}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Play className="h-5 w-5 mr-2" />
          )}
          Start RUN
        </Button>

        <Button
          size="lg"
          variant={currentEvent?.event_type === 'DOWNTIME' ? 'destructive' : 'outline'}
          className="h-16 text-base font-medium"
          onClick={() => setShowDowntimeDialog(true)}
          disabled={isLoading || isLocked}
        >
          <Pause className="h-5 w-5 mr-2" />
          Downtime
        </Button>

        <Button
          size="lg"
          variant={currentEvent?.event_type === 'SETUP' ? 'default' : 'outline'}
          className={cn(
            'h-16 text-base font-medium',
            currentEvent?.event_type === 'SETUP' && 'bg-yellow-600 hover:bg-yellow-700'
          )}
          onClick={() => setShowSetupDialog(true)}
          disabled={isLoading || isLocked}
        >
          <Wrench className="h-5 w-5 mr-2" />
          Setup
        </Button>

        <Button
          size="lg"
          variant="secondary"
          className="h-16 text-base font-medium"
          onClick={() => setShowStopDialog(true)}
          disabled={isLoading || isLocked || !currentEvent}
        >
          <StopCircle className="h-5 w-5 mr-2" />
          Stop
        </Button>
      </div>

      {/* Downtime Dialog */}
      <Dialog open={showDowntimeDialog} onOpenChange={setShowDowntimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เริ่ม Downtime</DialogTitle>
            <DialogDescription>
              เลือกสาเหตุการหยุดเครื่อง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสาเหตุ" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(downtimeCategories).map(([category, reasons]) => (
                  reasons.length > 0 && (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category}
                      </div>
                      {reasons.map((reason) => (
                        <SelectItem key={reason.id} value={reason.id}>
                          {reason.name}
                        </SelectItem>
                      ))}
                    </div>
                  )
                ))}
              </SelectContent>
            </Select>
            {isChangeoverReason && (
              <div className="space-y-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                <Label htmlFor="std-co" className="text-sm font-medium">
                  เวลามาตรฐาน Changeover (นาที)
                  <span className="ml-2 text-xs text-muted-foreground">— ส่วนที่เกินจะลด Availability</span>
                </Label>
                <Input
                  id="std-co"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="เช่น 30"
                  value={stdSetupMinutes}
                  onChange={(e) => setStdSetupMinutes(e.target.value)}
                />
              </div>
            )}
            <Textarea
              placeholder="หมายเหตุ (ถ้ามี)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDowntimeDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDowntimeSubmit}
              disabled={!selectedReasonId}
            >
              เริ่ม Downtime
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เริ่ม Setup</DialogTitle>
            <DialogDescription>
              เลือกสาเหตุการ Setup
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสาเหตุ" />
              </SelectTrigger>
              <SelectContent>
                {setupReasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
              <Label htmlFor="std-setup" className="text-sm font-medium">
                เวลามาตรฐาน Setup (นาที)
                <span className="ml-2 text-xs text-muted-foreground">— ส่วนที่เกินจะลด Availability</span>
              </Label>
              <Input
                id="std-setup"
                type="number"
                step="0.5"
                min="0"
                placeholder="เช่น 30"
                value={stdSetupMinutes}
                onChange={(e) => setStdSetupMinutes(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="หมายเหตุ (ถ้ามี)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSetupSubmit}
              disabled={!selectedReasonId}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              เริ่ม Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>หยุดเหตุการณ์</DialogTitle>
            <DialogDescription>
              ยืนยันการหยุดเหตุการณ์ปัจจุบัน
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="หมายเหตุ (ถ้ามี)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              ยกเลิก
            </Button>
            <Button variant="secondary" onClick={handleStopSubmit}>
              หยุดเหตุการณ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
