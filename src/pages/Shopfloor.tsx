import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlantLineSelector } from '@/components/shopfloor/PlantLineSelector';
import { MachineSelector } from '@/components/shopfloor/MachineSelector';
import { CurrentShiftBanner } from '@/components/shopfloor/CurrentShiftBanner';
import { EventControls } from '@/components/shopfloor/EventControls';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { EventTimeline } from '@/components/shopfloor/EventTimeline';
import { LockedBanner } from '@/components/shopfloor/LockedBanner';
import { MyMachinesViewer } from '@/components/shopfloor/MyMachinesViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Factory, Activity, Package, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getPlants,
  getLines,
  getMachines,
  getTodayShiftCalendar,
  getCurrentEvent,
  getProductionEvents,
  getDowntimeReasons,
  getDefectReasons,
  startEvent,
  stopEvent,
  addCounts,
  getSession,
} from '@/services';
import type { 
  Plant, 
  Line, 
  Machine, 
  ShiftCalendar, 
  ProductionEvent,
  DowntimeReason,
  DefectReason,
  EventType,
} from '@/services/types';

export default function Shopfloor() {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('capture');

  useEffect(() => {
    getSession().then(session => {
      setIsAuthenticated(!!session);
    });
  }, []);

  // Filter by company if user has a company context
  const companyId = company?.id;

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => getPlants(companyId),
    enabled: isAuthenticated === true,
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['lines', selectedPlantId, companyId],
    queryFn: () => getLines(selectedPlantId!, companyId),
    enabled: !!selectedPlantId,
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', selectedLineId, companyId],
    queryFn: () => getMachines(selectedLineId!, companyId),
    enabled: !!selectedLineId,
  });

  const { data: shiftCalendar = [], isLoading: shiftLoading } = useQuery({
    queryKey: ['shiftCalendar', selectedPlantId],
    queryFn: () => getTodayShiftCalendar(selectedPlantId!),
    enabled: !!selectedPlantId,
    refetchInterval: 60000,
  });

  const currentShift = shiftCalendar[0] as ShiftCalendar | undefined;
  const isLocked = currentShift?.shift?.is_active === false;

  const { data: currentEvent, isLoading: eventLoading } = useQuery({
    queryKey: ['currentEvent', selectedMachineId],
    queryFn: () => getCurrentEvent(selectedMachineId!),
    enabled: !!selectedMachineId,
    refetchInterval: 5000,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['productionEvents', selectedMachineId, currentShift?.id],
    queryFn: () => getProductionEvents(selectedMachineId!, currentShift?.id),
    enabled: !!selectedMachineId && !!currentShift?.id,
  });

  const { data: downtimeReasons = [] } = useQuery({
    queryKey: ['downtimeReasons'],
    queryFn: () => getDowntimeReasons(),
    enabled: isAuthenticated === true,
  });

  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons'],
    queryFn: () => getDefectReasons(),
    enabled: isAuthenticated === true,
  });

  const startEventMutation = useMutation({
    mutationFn: async ({ eventType, reasonId, notes }: { eventType: EventType; reasonId?: string; notes?: string }) => {
      return startEvent(selectedMachineId!, eventType, reasonId, notes);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['currentEvent'] });
        queryClient.invalidateQueries({ queryKey: ['productionEvents'] });
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
        queryClient.invalidateQueries({ queryKey: ['currentEvent'] });
        queryClient.invalidateQueries({ queryKey: ['productionEvents'] });
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

  useEffect(() => {
    setSelectedLineId(null);
    setSelectedMachineId(null);
  }, [selectedPlantId]);

  useEffect(() => {
    setSelectedMachineId(null);
  }, [selectedLineId]);

  const selectedPlant = plants.find(p => p.id === selectedPlantId);
  const selectedLine = lines.find(l => l.id === selectedLineId);
  const selectedMachine = machines.find(m => m.id === selectedMachineId);

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
        {/* Header */}
        <PageHeader 
          title="Shopfloor" 
          description="บันทึกเหตุการณ์และจำนวนผลิต"
          icon={Factory}
        />

        {/* Tabs */}
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

            {/* Plant/Line/Machine Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PlantLineSelector
                plants={plants}
                lines={lines}
                selectedPlantId={selectedPlantId}
                selectedLineId={selectedLineId}
                onPlantChange={setSelectedPlantId}
                onLineChange={setSelectedLineId}
                isLoading={plantsLoading || linesLoading}
              />
              <MachineSelector
                machines={machines}
                selectedMachineId={selectedMachineId}
                onMachineChange={setSelectedMachineId}
                isLoading={machinesLoading}
                disabled={!selectedLineId}
              />
            </div>

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
                        onStartRun={() => startEventMutation.mutate({ eventType: 'RUN' })}
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
                    <CardContent className="pt-5">
                      <AddCountsForm
                        defectReasons={defectReasons}
                        onSubmit={(data) => addCountsMutation.mutate(data)}
                        isLoading={addCountsMutation.isPending}
                        isLocked={isLocked}
                      />
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
      </div>
    </AppLayout>
  );
}
