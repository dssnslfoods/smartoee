import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlantLineSelector } from '@/components/shopfloor/PlantLineSelector';
import { MachineSelector } from '@/components/shopfloor/MachineSelector';
import { StaffMachineSelector } from '@/components/shopfloor/StaffMachineSelector';
import { SKUSelector } from '@/components/shopfloor/SKUSelector';
import { CurrentShiftBanner } from '@/components/shopfloor/CurrentShiftBanner';
import { EventControls } from '@/components/shopfloor/EventControls';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { ProductionCountHistory } from '@/components/shopfloor/ProductionCountHistory';
import { EventTimeline } from '@/components/shopfloor/EventTimeline';
import { LockedBanner } from '@/components/shopfloor/LockedBanner';
import { MyMachinesViewer } from '@/components/shopfloor/MyMachinesViewer';
import { ProductionBenchmarkCard } from '@/components/shopfloor/ProductionBenchmarkCard';
import { InlineStandardDialog } from '@/components/shopfloor/InlineStandardDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Factory, Activity, Package, Monitor, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getPlants,
  getLines,
  getMachines,
  getProducts,
  getProductionStandard,
  getProductionStandardsForMachine,
  getTodayShiftCalendar,
  getCurrentEvent,
  getProductionEvents,
  getDowntimeReasons,
  getDefectReasons,
  getSetupReasons,
  startEvent,
  stopEvent,
  addCounts,
  getSession,
  getPermittedMachineIds,
} from '@/services';
import type { 
  ShiftCalendar, 
  EventType,
  Product,
  ProductionStandard,
} from '@/services/types';

export default function Shopfloor() {
  const queryClient = useQueryClient();
  const { company, isAdmin, hasRole } = useAuth();
  
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('capture');
  const [standardDialogProduct, setStandardDialogProduct] = useState<Product | null>(null);

  // Admin or Supervisor can create production standards inline
  const canCreateStandard = isAdmin() || hasRole('SUPERVISOR');

  useEffect(() => {
    getSession().then(session => {
      setIsAuthenticated(!!session);
    });
  }, []);

  const companyId = company?.id;

  // Determine if user is STAFF (not admin/supervisor)
  const isStaff = hasRole('STAFF') && !isAdmin() && !hasRole('SUPERVISOR');

  // ---- STAFF: fetch all permitted machines directly ----
  const { data: staffMachines = [], isLoading: staffMachinesLoading } = useQuery({
    queryKey: ['staffPermittedMachines', companyId],
    queryFn: async () => {
      const ids = await getPermittedMachineIds();
      if (ids.length === 0) return [];
      // Fetch full machine data with line/plant info
      const allM = await getMachines(undefined, companyId);
      const idSet = new Set(ids);
      return allM.filter(m => idSet.has(m.id));
    },
    enabled: isStaff && isAuthenticated === true,
    staleTime: 60000,
  });

  // ---- NON-STAFF: existing Plant → Line → Machine flow ----
  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => getPlants(companyId),
    enabled: !isStaff && isAuthenticated === true,
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['lines', selectedPlantId, companyId],
    queryFn: () => getLines(selectedPlantId!, companyId),
    enabled: !isStaff && !!selectedPlantId,
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', selectedLineId, companyId],
    queryFn: () => getMachines(selectedLineId!, companyId),
    enabled: !isStaff && !!selectedLineId,
  });

  // Determine the effective plant ID for shift calendar
  // For STAFF: derive from the selected machine's line.plant
  const selectedMachine = isStaff
    ? staffMachines.find(m => m.id === selectedMachineId)
    : machines.find(m => m.id === selectedMachineId);

  const effectivePlantId = isStaff
    ? selectedMachine?.line?.plant?.id ?? null
    : selectedPlantId;

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => getProducts(companyId),
    enabled: isAuthenticated === true,
  });

  const { data: shiftCalendar = [] } = useQuery({
    queryKey: ['shiftCalendar', effectivePlantId],
    queryFn: () => getTodayShiftCalendar(effectivePlantId!),
    enabled: !!effectivePlantId,
    refetchInterval: 60000,
  });

  // Find the shift that matches current time — only consider ACTIVE shifts
  const currentShift = useMemo(() => {
    // Filter to only active shift definitions
    const activeShifts = shiftCalendar.filter(sc => sc.shift?.is_active !== false);
    if (activeShifts.length === 0) return shiftCalendar[0] as ShiftCalendar | undefined; // fallback to any
    
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTimeInSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds;
    
    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':').map(Number);
      return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    };
    
    const matchedShift = activeShifts.find(sc => {
      const start = sc.shift?.start_time;
      const end = sc.shift?.end_time;
      if (!start || !end) return false;
      
      const startSec = parseTime(start);
      const endSec = parseTime(end);
      
      if (startSec <= endSec) {
        // Normal shift (e.g., 06:00 - 14:00)
        return currentTimeInSeconds >= startSec && currentTimeInSeconds < endSec;
      } else {
        // Overnight shift (e.g., 22:00 - 06:00)
        return currentTimeInSeconds >= startSec || currentTimeInSeconds < endSec;
      }
    });
    
    return (matchedShift || activeShifts[0]) as ShiftCalendar | undefined;
  }, [shiftCalendar]);

  // Check actual lock status from shift_approvals (not shift.is_active which is soft-delete)
  const { data: shiftApproval } = useQuery({
    queryKey: ['shiftApproval', currentShift?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_approvals')
        .select('status')
        .eq('shift_calendar_id', currentShift!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentShift?.id,
  });
  
  const isLocked = shiftApproval?.status === 'LOCKED';

  const { data: currentEvent } = useQuery({
    queryKey: ['currentEvent', selectedMachineId],
    queryFn: () => getCurrentEvent(selectedMachineId!),
    enabled: !!selectedMachineId,
    refetchInterval: 5000,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['productionEvents', selectedMachineId, currentShift?.id],
    queryFn: () => getProductionEvents(selectedMachineId!, currentShift?.id),
    enabled: !!selectedMachineId && !!currentShift?.id,
    refetchInterval: 10000,
  });


  const { data: downtimeReasons = [] } = useQuery({
    queryKey: ['downtimeReasons', company?.id],
    queryFn: () => getDowntimeReasons(undefined, company?.id),
    enabled: isAuthenticated === true,
  });

  const { data: setupReasons = [] } = useQuery({
    queryKey: ['setupReasons', company?.id],
    queryFn: () => getSetupReasons(company?.id),
    enabled: isAuthenticated === true,
  });

  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons', company?.id],
    queryFn: () => getDefectReasons(company?.id),
    enabled: isAuthenticated === true,
  });

  // selectedMachine is already defined above based on role
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  // Fetch production standard for current machine+SKU pair
  const { data: productionStandard } = useQuery({
    queryKey: ['productionStandard', selectedMachineId, selectedProductId],
    queryFn: () => getProductionStandard(selectedMachineId!, selectedProductId!),
    enabled: !!selectedMachineId && !!selectedProductId,
  });

  // Fetch ALL standards for the selected machine (for timeline warnings)
  const { data: machineStandards = [] } = useQuery({
    queryKey: ['machineStandards', selectedMachineId],
    queryFn: () => getProductionStandardsForMachine(selectedMachineId!),
    enabled: !!selectedMachineId,
  });

  // Build a map of product_id -> ProductionStandard for the timeline
  const standardsMap = useMemo(() => {
    const map = new Map<string, typeof machineStandards[0]>();
    for (const s of machineStandards) {
      map.set(s.product_id, s);
    }
    return map;
  }, [machineStandards]);

  // Determine effective cycle time: production_standards > machine default (no product-level CT)
  const effectiveCycleTime = productionStandard?.ideal_cycle_time_seconds 
    ?? selectedMachine?.ideal_cycle_time_seconds;
  
  const cycleTimeSource = productionStandard
    ? `from Standard: ${selectedProduct?.code}`
    : 'Machine Default';

  const noBenchmarkWarning = selectedProduct && selectedMachine && !productionStandard
    ? `No benchmark defined for ${selectedProduct.code} on ${selectedMachine.name}`
    : null;

  const handleProductChange = async (productId: string | null) => {
    if (
      currentEvent?.event_type === 'RUN' &&
      productId !== null &&
      selectedProductId !== null &&
      productId !== selectedProductId
    ) {
      // SKU changed while running - stop current, start new with new SKU
      try {
        await stopEvent(selectedMachineId!);
        setSelectedProductId(productId);
        await startEvent(selectedMachineId!, 'RUN', undefined, undefined, productId);
        queryClient.invalidateQueries({ queryKey: ['currentEvent', selectedMachineId] });
        queryClient.invalidateQueries({ queryKey: ['productionEvents', selectedMachineId, currentShift?.id] });
        toast.success('เปลี่ยน SKU สำเร็จ - หยุด Session เดิมและเริ่ม Session ใหม่');
      } catch (error: any) {
        toast.error(error.message || 'ไม่สามารถเปลี่ยน SKU ได้');
      }
    } else {
      setSelectedProductId(productId);
    }
  };

  const startEventMutation = useMutation({
    mutationFn: async ({ eventType, reasonId, notes }: { eventType: EventType; reasonId?: string; notes?: string }) => {
      return startEvent(selectedMachineId!, eventType, reasonId, notes, 
        eventType === 'RUN' ? selectedProductId || undefined : undefined
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['currentEvent', selectedMachineId] });
        queryClient.invalidateQueries({ queryKey: ['productionEvents', selectedMachineId, currentShift?.id] });
      } else {
        toast.error(data.message || 'Failed to start event');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start event');
    },
  });

  const stopEventMutation = useMutation({
    mutationFn: async (notes?: string) => {
      return stopEvent(selectedMachineId!, notes);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['currentEvent', selectedMachineId] });
        queryClient.invalidateQueries({ queryKey: ['productionEvents', selectedMachineId, currentShift?.id] });
      } else {
        toast.error(data.message || 'Failed to stop event');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to stop event');
    },
  });

  const addCountsMutation = useMutation({
    mutationFn: async ({ goodQty, rejectQty, defectReasonId, notes }: { 
      goodQty: number; 
      rejectQty: number; 
      defectReasonId?: string; 
      notes?: string;
    }) => {
      return addCounts(selectedMachineId!, goodQty, rejectQty, defectReasonId, notes);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['productionCounts'] });
      } else {
        toast.error(data.message || 'Failed to add counts');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add counts');
    },
  });

  const handleStartRun = () => {
    if (!selectedProductId) {
      toast.error('กรุณาเลือก SKU ก่อนเริ่มงาน');
      return;
    }
    startEventMutation.mutate({ eventType: 'RUN' });
  };

  // Reset effects only for non-STAFF flow
  useEffect(() => {
    if (!isStaff) {
      setSelectedLineId(null);
      setSelectedMachineId(null);
    }
  }, [selectedPlantId, isStaff]);

  useEffect(() => {
    if (!isStaff) {
      setSelectedMachineId(null);
    }
  }, [selectedLineId, isStaff]);

  // Auto-select when only one option is available
  useEffect(() => {
    if (!isStaff && plants.length === 1 && !selectedPlantId) {
      setSelectedPlantId(plants[0].id);
    }
  }, [plants, isStaff, selectedPlantId]);

  useEffect(() => {
    if (!isStaff && lines.length === 1 && !selectedLineId && selectedPlantId) {
      setSelectedLineId(lines[0].id);
    }
  }, [lines, isStaff, selectedLineId, selectedPlantId]);

  useEffect(() => {
    if (!isStaff && machines.length === 1 && !selectedMachineId && selectedLineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, isStaff, selectedMachineId, selectedLineId]);

  useEffect(() => {
    if (isStaff && staffMachines.length === 1 && !selectedMachineId) {
      setSelectedMachineId(staffMachines[0].id);
    }
  }, [staffMachines, isStaff, selectedMachineId]);

  if (isAuthenticated === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isAuthenticated === false) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <Factory className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">กรุณาเข้าสู่ระบบ</h2>
            <p className="text-muted-foreground">คุณต้องเข้าสู่ระบบก่อนใช้งาน Shopfloor</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container space-y-5">
        <PageHeader 
          title="Shopfloor" 
          description="บันทึกเหตุการณ์และจำนวนผลิต"
          icon={Factory}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger 
              value="capture" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">บันทึกเหตุการณ์</span>
              <span className="sm:hidden">บันทึก</span>
            </TabsTrigger>
            <TabsTrigger 
              value="my-machines" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">เครื่องจักรของฉัน</span>
              <span className="sm:hidden">เครื่องจักร</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="space-y-5 mt-5">
            {isLocked && <LockedBanner />}


            {/* Machine Selection */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Factory className="h-5 w-5 text-primary" />
                  </div>
                  {isStaff ? 'เครื่องจักรของฉัน' : 'เลือกเครื่องจักร'}
                  {selectedMachine && (
                    <Badge variant="secondary" className="font-medium text-xs">
                      {selectedMachine.name}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {isStaff ? (
                  /* STAFF: show all permitted machines with plant/line labels */
                  <StaffMachineSelector
                    machines={staffMachines}
                    selectedMachineId={selectedMachineId}
                    onMachineChange={setSelectedMachineId}
                    isLoading={staffMachinesLoading}
                  />
                ) : (
                  /* NON-STAFF: Plant → Line → Machine flow */
                  <>
                    <PlantLineSelector
                      plants={plants}
                      lines={lines}
                      selectedPlantId={selectedPlantId}
                      selectedLineId={selectedLineId}
                      onPlantChange={setSelectedPlantId}
                      onLineChange={setSelectedLineId}
                      isLoading={plantsLoading || linesLoading}
                    />

                    {selectedLineId && (
                      <div className="border-t border-border" />
                    )}

                    <MachineSelector
                      machines={machines}
                      selectedMachineId={selectedMachineId}
                      onMachineChange={setSelectedMachineId}
                      isLoading={machinesLoading}
                      disabled={!selectedLineId}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* SKU Selector - shown when machine is selected */}
            {selectedMachineId && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/50">
                      <Package className="h-5 w-5 text-accent-foreground" />
                    </div>
                    เลือก Product / SKU
                    {selectedProduct && (
                      <Badge variant="secondary" className="font-medium text-xs">
                        {selectedProduct.code}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <SKUSelector
                    products={products}
                    selectedProductId={selectedProductId}
                    onProductChange={handleProductChange}
                    standardsMap={standardsMap}
                    machineCycleTime={selectedMachine?.ideal_cycle_time_seconds}
                    machineTimeUnit={selectedMachine?.time_unit}
                    effectiveCycleTime={effectiveCycleTime}
                    cycleTimeSource={cycleTimeSource}
                    noBenchmarkWarning={noBenchmarkWarning}
                    isLoading={productsLoading}
                    disabled={isLocked}
                    canCreateStandard={canCreateStandard}
                    onCreateStandard={(product) => setStandardDialogProduct(product)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Production Benchmark - shown when machine + SKU selected */}
            {selectedMachineId && selectedProductId && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-oee-overall/10">
                      <BarChart3 className="h-5 w-5 text-oee-overall" />
                    </div>
                    ค่ามาตรฐานการผลิต
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ProductionBenchmarkCard
                    productionStandard={productionStandard}
                    machineName={selectedMachine?.name}
                    machineCode={selectedMachine?.code}
                    machineCycleTime={selectedMachine?.ideal_cycle_time_seconds}
                    machineTimeUnit={selectedMachine?.time_unit}
                    productName={selectedProduct?.name}
                    productCode={selectedProduct?.code}
                    noBenchmarkWarning={noBenchmarkWarning}
                  />
                </CardContent>
              </Card>
            )}

            {currentShift && (
              <CurrentShiftBanner 
                shiftCalendar={currentShift} 
                isLocked={isLocked}
              />
            )}

            {selectedMachineId && selectedMachine && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-5">
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/30">
                      <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        สถานะเครื่องจักร
                        {currentEvent && (
                          <Badge 
                            variant={currentEvent.event_type === 'RUN' ? 'default' : 'destructive'}
                            className="font-medium"
                          >
                            {currentEvent.event_type}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <EventControls
                        currentEvent={currentEvent}
                        downtimeReasons={downtimeReasons}
                        setupReasons={setupReasons}
                        selectedProduct={selectedProduct}
                        machineCycleTime={selectedMachine?.ideal_cycle_time_seconds}
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
                        isLocked={isLocked}
                      />
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/30">
                      <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-running/10">
                          <Package className="h-5 w-5 text-status-running" />
                        </div>
                        บันทึกจำนวนผลิต
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-5">
                      <AddCountsForm
                        defectReasons={defectReasons}
                        onSubmit={(data) => addCountsMutation.mutate(data)}
                        isLoading={addCountsMutation.isPending}
                        isLocked={isLocked}
                      />
                      
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          ประวัติการบันทึกในกะนี้
                        </h4>
                        <ProductionCountHistory
                          machineId={selectedMachineId}
                          shiftCalendarId={currentShift?.id}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="h-fit overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-base sm:text-lg">Timeline เหตุการณ์วันนี้</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <EventTimeline
                      events={events}
                      isLoading={eventsLoading}
                      standardsMap={standardsMap}
                      machineCycleTime={selectedMachine?.ideal_cycle_time_seconds}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {!selectedMachineId && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
                    <Factory className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">เลือกเครื่องจักร</h3>
                  <p className="text-muted-foreground max-w-sm">
                    กรุณาเลือก Plant, Line และ Machine เพื่อเริ่มบันทึกเหตุการณ์
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my-machines" className="mt-5">
            <MyMachinesViewer />
          </TabsContent>
        </Tabs>

        {/* Inline Standard Dialog for Admin/Supervisor */}
        {selectedMachine && standardDialogProduct && companyId && (
          <InlineStandardDialog
            open={!!standardDialogProduct}
            onOpenChange={(open) => { if (!open) setStandardDialogProduct(null); }}
            machine={selectedMachine}
            product={standardDialogProduct}
            companyId={companyId}
            onCreated={() => setStandardDialogProduct(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
