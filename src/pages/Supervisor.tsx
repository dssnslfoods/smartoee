import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Lock, ClipboardCheck, Timer, Clock, Cpu, Package, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuditLogViewer } from '@/components/supervisor/AuditLogViewer';
import { StaffManager } from '@/components/supervisor/StaffManager';
import { PermissionGroupManager } from '@/components/supervisor/PermissionGroupManager';
import { ShiftApprovalCalendar } from '@/components/supervisor/ShiftApprovalCalendar';
import {
  ShiftManager,
  PlannedTimeManager,
  MachineManager,
  ProductManager,
  ProductionStandardsManager,
} from '@/components/admin';
import oeeApi from '@/services/oeeApi';

export default function Supervisor() {
  const { hasRole, company } = useAuth();
  
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');

  const companyId = company?.id;

  const { data: plants = [] } = useQuery({
    queryKey: ['plants', companyId],
    queryFn: () => oeeApi.getPlants(companyId),
  });

  const isSupervisor = hasRole('SUPERVISOR') || hasRole('ADMIN');

  if (!isSupervisor) {
    return (
      <AppLayout>
        <div className="page-container">
          <Card className="max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
              <p className="text-muted-foreground">
                หน้านี้สำหรับ Supervisor และ Admin เท่านั้น
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader 
          title="Supervisor Dashboard" 
          description="จัดการและปิดกะ"
          icon={ClipboardCheck}
        >
          <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
            <SelectTrigger className="w-[160px] sm:w-[180px] bg-background">
              <SelectValue placeholder="เลือกโรงงาน" />
            </SelectTrigger>
            <SelectContent>
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageHeader>

        {!selectedPlantId ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">เลือกโรงงาน</h3>
              <p className="text-muted-foreground max-w-sm">
                กรุณาเลือกโรงงานเพื่อดูข้อมูลกะและอนุมัติการผลิต
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="shifts" className="space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="inline-flex h-auto p-1 bg-muted/50 gap-1 min-w-max">
                <TabsTrigger value="shifts" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">อนุมัติกะ</span>
                </TabsTrigger>
                <TabsTrigger value="groups" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  กลุ่มสิทธิ์
                </TabsTrigger>
                <TabsTrigger value="staff" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  จัดการพนักงาน
                </TabsTrigger>
                <TabsTrigger value="audit" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Audit Log
                </TabsTrigger>
                <TabsTrigger value="shift-config" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Timer className="h-4 w-4" />
                  <span className="hidden sm:inline">กะทำงาน</span>
                </TabsTrigger>
                <TabsTrigger value="planned-time" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">เวลาวางแผน</span>
                </TabsTrigger>
                <TabsTrigger value="machines" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Cpu className="h-4 w-4" />
                  <span className="hidden sm:inline">เครื่องจักร</span>
                </TabsTrigger>
                <TabsTrigger value="products" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">สินค้า</span>
                </TabsTrigger>
                <TabsTrigger value="standards" className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">มาตรฐาน</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="shifts" className="mt-0">
              <ShiftApprovalCalendar plantId={selectedPlantId} isSupervisor={isSupervisor} />
            </TabsContent>

            <TabsContent value="groups" className="mt-0">
              <PermissionGroupManager />
            </TabsContent>

            <TabsContent value="staff" className="mt-0">
              <StaffManager />
            </TabsContent>

            <TabsContent value="audit" className="mt-0">
              <AuditLogViewer plantId={selectedPlantId} date={format(new Date(), 'yyyy-MM-dd')} />
            </TabsContent>

            <TabsContent value="shift-config" className="mt-0">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <ShiftManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="planned-time" className="mt-0">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <PlannedTimeManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="machines" className="mt-0">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <MachineManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="mt-0">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <ProductManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="standards" className="mt-0">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <ProductionStandardsManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
