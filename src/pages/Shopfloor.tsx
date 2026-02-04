import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlantLineSelector } from '@/components/shopfloor/PlantLineSelector';
import { MachineSelector } from '@/components/shopfloor/MachineSelector';
import { CurrentShiftBanner } from '@/components/shopfloor/CurrentShiftBanner';
import { EventControls } from '@/components/shopfloor/EventControls';
import { AddCountsForm } from '@/components/shopfloor/AddCountsForm';
import { EventTimeline } from '@/components/shopfloor/EventTimeline';
import { LockedBanner } from '@/components/shopfloor/LockedBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Factory, Activity, Package } from 'lucide-react';
import { toast } from 'sonner';
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
  
  // Selection state
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication
  useEffect(() => {
    getSession().then(session => {
      setIsAuthenticated(!!session);
    });
  }, []);

  // Fetch plants
  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: getPlants,
    enabled: isAuthenticated === true,
  });

  // Fetch lines for selected plant
  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['lines', selectedPlantId],
    queryFn: () => getLines(selectedPlantId!),
    enabled: !!selectedPlantId,
  });

  // Fetch machines for selected line
  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', selectedLineId],
    queryFn: () => getMachines(selectedLineId!),
    enabled: !!selectedLineId,
  });

  // Fetch today's shift calendar
  const { data: shiftCalendar = [], isLoading: shiftLoading } = useQuery({
    queryKey: ['shiftCalendar', selectedPlantId],
    queryFn: () => getTodayShiftCalendar(selectedPlantId!),
    enabled: !!selectedPlantId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Current shift (first one for today)
  const currentShift = shiftCalendar[0] as ShiftCalendar | undefined;
  const isLocked = currentShift?.shift?.is_active === false; // TODO: Get from shift_approvals

  // Fetch current event for selected machine
  const { data: currentEvent, isLoading: eventLoading } = useQuery({
    queryKey: ['currentEvent', selectedMachineId],
    queryFn: () => getCurrentEvent(selectedMachineId!),
    enabled: !!selectedMachineId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch production events for timeline
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['productionEvents', selectedMachineId, currentShift?.id],
    queryFn: () => getProductionEvents(selectedMachineId!, currentShift?.id),
    enabled: !!selectedMachineId && !!currentShift?.id,
  });

  // Fetch downtime reasons
  const { data: downtimeReasons = [] } = useQuery({
    queryKey: ['downtimeReasons'],
    queryFn: () => getDowntimeReasons(),
    enabled: isAuthenticated === true,
  });

  // Fetch defect reasons
  const { data: defectReasons = [] } = useQuery({
    queryKey: ['defectReasons'],
    queryFn: () => getDefectReasons(),
    enabled: isAuthenticated === true,
  });

  // Start event mutation
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

  // Stop event mutation
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

  // Add counts mutation
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

  // Reset selections when parent changes
  useEffect(() => {
    setSelectedLineId(null);
    setSelectedMachineId(null);
  }, [selectedPlantId]);

  useEffect(() => {
    setSelectedMachineId(null);
  }, [selectedLineId]);

  // Selected entities
  const selectedPlant = plants.find(p => p.id === selectedPlantId);
  const selectedLine = lines.find(l => l.id === selectedLineId);
  const selectedMachine = machines.find(m => m.id === selectedMachineId);

  if (isAuthenticated === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (isAuthenticated === false) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Factory className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-muted-foreground">คุณต้องเข้าสู่ระบบก่อนใช้งาน Shopfloor</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Factory className="h-7 w-7" />
            Shopfloor Event Capture
          </h1>
          <p className="text-muted-foreground">
            บันทึกเหตุการณ์และจำนวนผลิต
          </p>
        </div>

        {/* Locked Banner */}
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

        {/* Current Shift Banner */}
        {currentShift && (
          <CurrentShiftBanner 
            shiftCalendar={currentShift} 
            isLocked={isLocked}
          />
        )}

        {/* Main Content - Only show when machine selected */}
        {selectedMachineId && selectedMachine && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column - Event Controls & Counts */}
            <div className="space-y-4">
              {/* Event Controls */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5" />
                    สถานะเครื่องจักร
                    {currentEvent && (
                      <Badge variant={currentEvent.event_type === 'RUN' ? 'default' : 'destructive'}>
                        {currentEvent.event_type}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
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

              {/* Add Counts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    บันทึกจำนวนผลิต
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AddCountsForm
                    defectReasons={defectReasons}
                    onSubmit={(data) => addCountsMutation.mutate(data)}
                    isLoading={addCountsMutation.isPending}
                    isLocked={isLocked}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Timeline */}
            <Card className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Timeline เหตุการณ์วันนี้</CardTitle>
              </CardHeader>
              <CardContent>
                <EventTimeline
                  events={events}
                  isLoading={eventsLoading}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!selectedMachineId && (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Factory className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">เลือกเครื่องจักร</h3>
              <p className="text-muted-foreground max-w-md">
                กรุณาเลือก Plant, Line และ Machine เพื่อเริ่มบันทึกเหตุการณ์
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
