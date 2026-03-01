import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventControls } from '@/components/shopfloor/EventControls';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { SKUSelector } from '@/components/shopfloor/SKUSelector';
import { InlineStandardDialog } from '@/components/shopfloor/InlineStandardDialog';
import { Activity, Package, Play, Pause, AlertTriangle, Wrench, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getCurrentEvent,
  getProducts,
  getDowntimeReasons,
  getDefectReasons,
  getSetupReasons,
  getProductionStandard,
  getProductionStandardsForMachine,
  startEvent,
  stopEvent,
  addCounts,
  getMachineById,
} from '@/services';
import type { EventType, Product } from '@/services/types';

const statusConfig = {
  running: { label: 'Running', icon: Play, textClass: 'text-status-running', bgClass: 'bg-status-running/10' },
  idle: { label: 'Idle', icon: Pause, textClass: 'text-status-idle', bgClass: 'bg-status-idle/10' },
  stopped: { label: 'Stopped', icon: AlertTriangle, textClass: 'text-status-stopped', bgClass: 'bg-status-stopped/10' },
  maintenance: { label: 'Setup', icon: Wrench, textClass: 'text-status-maintenance', bgClass: 'bg-status-maintenance/10' },
};

interface MonitorControlSheetProps {
  machineId: string | null;
  machineName?: string;
  machineCode?: string;
  machineStatus?: 'running' | 'idle' | 'stopped' | 'maintenance';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonitorControlSheet({
  machineId,
  machineName,
  machineCode,
  machineStatus = 'idle',
  open,
  onOpenChange,
}: MonitorControlSheetProps) {
  const queryClient = useQueryClient();
  const { company, isAdmin, hasRole } = useAuth();
  const companyId = company?.id;
  const canCreateStandard = isAdmin() || hasRole('SUPERVISOR');

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('control');
  const [standardDialogProduct, setStandardDialogProduct] = useState<Product | null>(null);

  // Fetch machine details
  const { data: machine } = useQuery({
    queryKey: ['machineDetail', machineId],
    queryFn: () => getMachineById(machineId!),
    enabled: !!machineId && open,
  });

  // Fetch current event for this machine
  const { data: currentEvent, isLoading: eventLoading } = useQuery({
    queryKey: ['currentEvent', machineId],
    queryFn: () => getCurrentEvent(machineId!),
    enabled: !!machineId && open,
    refetchInterval: 5000,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => getProducts(companyId),
    enabled: !!machineId && open,
  });

  // Fetch downtime reasons
  const { data: downtimeReasons = [] } = useQuery({
    queryKey: ['downtimeReasons', companyId],
    queryFn: () => getDowntimeReasons(undefined, companyId),
    enabled: !!machineId && open,
  });

  const { data: setupReasons = [] } = useQuery({
    queryKey: ['setupReasons', companyId],
    queryFn: () => getSetupReasons(companyId),
    enabled: !!machineId && open,
  });

  // Fetch defect reasons
  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons', companyId],
    queryFn: () => getDefectReasons(companyId),
    enabled: !!machineId && open,
  });

  // Fetch production standard for current machine + selected product
  const { data: productionStandard } = useQuery({
    queryKey: ['productionStandard', machineId, selectedProductId],
    queryFn: () => getProductionStandard(machineId!, selectedProductId!),
    enabled: !!machineId && !!selectedProductId && open,
  });

  // Fetch all standards for the machine
  const { data: machineStandards = [] } = useQuery({
    queryKey: ['machineStandards', machineId],
    queryFn: () => getProductionStandardsForMachine(machineId!),
    enabled: !!machineId && open,
  });

  const standardsMap = useMemo(() => {
    const map = new Map<string, typeof machineStandards[0]>();
    for (const s of machineStandards) {
      map.set(s.product_id, s);
    }
    return map;
  }, [machineStandards]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  const effectiveCycleTime = productionStandard?.ideal_cycle_time_seconds
    ?? machine?.ideal_cycle_time_seconds;

  const cycleTimeSource = productionStandard
    ? `from Standard: ${selectedProduct?.code}`
    : 'Machine Default';

  const noBenchmarkWarning = selectedProduct && machine && !productionStandard
    ? `No benchmark for ${selectedProduct.code} on ${machine.name}`
    : null;

  // Reset SKU when machine changes — each machine must have its own SKU selection
  useEffect(() => {
    setSelectedProductId(null);
  }, [machineId]);

  // Mutations
  const startEventMutation = useMutation({
    mutationFn: async ({ eventType, reasonId, notes }: { eventType: EventType; reasonId?: string; notes?: string }) => {
      return startEvent(machineId!, eventType, reasonId, notes,
        eventType === 'RUN' ? selectedProductId || undefined : undefined
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'บันทึกสำเร็จ');
        invalidateQueries();
      } else {
        toast.error(data.message || 'ไม่สามารถบันทึกเหตุการณ์ได้');
      }
    },
    onError: (error: any) => {
      let errorMessage = error.message || 'ไม่สามารถบันทึกเหตุการณ์ได้';
      if (error.code === 'NOT_FOUND' && errorMessage.toLowerCase().includes('shift')) {
        errorMessage = '❌ ไม่สามารถเริ่มงานได้: ไม่พบกะการทำงาน (Shift) ที่เปิดในขณะนี้ หรืออยู่นอกเวลาทำงาน';
      } else if (error.code === 'SHIFT_LOCKED') {
        errorMessage = '❌ ไม่สามารถเริ่มงานได้: กะการทำงานปัจจุบันถูกปิดหรือล็อคแล้ว';
      }
      toast.error(errorMessage);
    },
  });

  const stopEventMutation = useMutation({
    mutationFn: async (notes?: string) => stopEvent(machineId!, notes),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        invalidateQueries();
      } else {
        toast.error(data.message || 'Failed to stop event');
      }
    },
    onError: (error: any) => toast.error(error.message || 'Failed to stop event'),
  });

  const addCountsMutation = useMutation({
    mutationFn: async ({ goodQty, rejectQty, defectReasonId, notes }: {
      goodQty: number; rejectQty: number; defectReasonId?: string; notes?: string;
    }) => addCounts(machineId!, goodQty, rejectQty, defectReasonId, notes),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'บันทึกจำนวนสำเร็จ');
        invalidateQueries();
      } else {
        toast.error(data.message || 'ไม่สามารถบันทึกจำนวนได้');
      }
    },
    onError: (error: any) => {
      let errorMessage = error.message || 'ไม่สามารถบันทึกจำนวนได้';
      if (error.code === 'NOT_FOUND' && errorMessage.toLowerCase().includes('shift')) {
        errorMessage = '❌ ไม่สามารถบันทึกยอดได้: ไม่พบกะการทำงาน (Shift)';
      } else if (error.code === 'SHIFT_LOCKED') {
        errorMessage = '❌ ไม่สามารถบันทึกยอดได้: กะการทำงานปัจจุบันถูกล็อคแล้ว';
      }
      toast.error(errorMessage);
    },
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['currentEvent', machineId] });
    queryClient.invalidateQueries({ queryKey: ['monitor-machines'] });
    queryClient.invalidateQueries({ queryKey: ['productionCounts'] });
  };

  const handleStartRun = () => {
    if (!selectedProductId) {
      toast.error('กรุณาเลือก SKU ก่อนเริ่มงาน');
      return;
    }
    startEventMutation.mutate({ eventType: 'RUN' });
  };

  const handleProductChange = async (productId: string | null) => {
    if (
      currentEvent?.event_type === 'RUN' &&
      productId !== null &&
      selectedProductId !== null &&
      productId !== selectedProductId
    ) {
      try {
        await stopEvent(machineId!);
        setSelectedProductId(productId);
        await startEvent(machineId!, 'RUN', undefined, undefined, productId);
        invalidateQueries();
        toast.success('เปลี่ยน SKU สำเร็จ');
      } catch (error: any) {
        toast.error(error.message || 'ไม่สามารถเปลี่ยน SKU ได้');
      }
    } else {
      setSelectedProductId(productId);
    }
  };

  const config = statusConfig[machineStatus];
  const StatusIcon = config.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            {machineName}
            <Badge variant="outline" className="font-mono text-xs">{machineCode}</Badge>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('border-0 font-medium text-xs', config.bgClass, config.textClass)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {machine?.line?.name && (
              <span className="text-xs">{machine.line.name} • {machine.line?.plant?.name}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="bg-muted/50 p-1 w-full">
            <TabsTrigger value="control" className="flex-1 gap-1.5 data-[state=active]:bg-background">
              <Activity className="h-3.5 w-3.5" />
              ควบคุม
            </TabsTrigger>
            <TabsTrigger value="counts" className="flex-1 gap-1.5 data-[state=active]:bg-background">
              <Package className="h-3.5 w-3.5" />
              จำนวนผลิต
            </TabsTrigger>
          </TabsList>

          <TabsContent value="control" className="space-y-4 mt-4">
            {/* SKU Selector */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  เลือก SKU
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SKUSelector
                  products={products.filter(p => !p.line_id || p.line_id === machine?.line_id)}
                  selectedProductId={selectedProductId}
                  onProductChange={handleProductChange}
                  standardsMap={standardsMap}
                  machineCycleTime={machine?.ideal_cycle_time_seconds}
                  machineTimeUnit={machine?.time_unit}
                  effectiveCycleTime={effectiveCycleTime}
                  cycleTimeSource={cycleTimeSource}
                  noBenchmarkWarning={noBenchmarkWarning}
                  isLoading={false}
                  disabled={false}
                  canCreateStandard={canCreateStandard}
                  onCreateStandard={(product) => setStandardDialogProduct(product)}
                />
              </CardContent>
            </Card>

            {/* Event Controls */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  ควบคุมเครื่องจักร
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  </div>
                ) : (
                  <EventControls
                    currentEvent={currentEvent}
                    downtimeReasons={downtimeReasons}
                    setupReasons={setupReasons}
                    selectedProduct={selectedProduct}
                    machineCycleTime={machine?.ideal_cycle_time_seconds}
                    effectiveCycleTime={effectiveCycleTime}
                    cycleTimeSource={cycleTimeSource}
                    noBenchmarkWarning={noBenchmarkWarning}
                    onStartRun={handleStartRun}
                    onStartDowntime={(reasonId, notes) =>
                      startEventMutation.mutate({ eventType: 'DOWNTIME', reasonId, notes })
                    }
                    onStartSetup={(reasonId, notes) =>
                      startEventMutation.mutate({ eventType: 'SETUP', reasonId, notes })
                    }
                    onStop={(notes) => stopEventMutation.mutate(notes)}
                    isLoading={startEventMutation.isPending || stopEventMutation.isPending}
                    isLocked={false}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="counts" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-status-running" />
                  บันทึกจำนวนผลิต
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddCountsForm
                  defectReasons={defectReasons}
                  onSubmit={(data) => addCountsMutation.mutate(data)}
                  isLoading={addCountsMutation.isPending}
                  isLocked={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Inline Standard Dialog for Admin/Supervisor */}
        {machine && standardDialogProduct && companyId && (
          <InlineStandardDialog
            open={!!standardDialogProduct}
            onOpenChange={(open) => { if (!open) setStandardDialogProduct(null); }}
            machine={machine}
            product={standardDialogProduct}
            companyId={companyId}
            onCreated={() => {
              setStandardDialogProduct(null);
              queryClient.invalidateQueries({ queryKey: ['machineStandards', machineId] });
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
