import { Navigate } from 'react-router-dom';
import { Settings, Factory, Layers, Cpu, AlertTriangle, Ban, Users, UserCog, Building2, Loader2, Package, BarChart3, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PlantManager,
  LineManager,
  MachineManager,
  ProductManager,
  ProductionStandardsManager,
  DowntimeReasonManager,
  DefectReasonManager,
  UserPermissionManager,
  UserManager,
  CompanyManager,
  PlannedTimeManager,
} from '@/components/admin';

export default function Admin() {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = hasRole('ADMIN');

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        {/* Header */}
        <PageHeader 
          title="Admin Setup" 
          description="Manage master data and permissions"
          icon={Settings}
        />

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto p-1 bg-muted/50 gap-1 min-w-max">
              <TabsTrigger 
                value="users" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger 
                value="companies" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Companies</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plants" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Factory className="h-4 w-4" />
                <span className="hidden sm:inline">Plants</span>
              </TabsTrigger>
              <TabsTrigger 
                value="lines" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Lines</span>
              </TabsTrigger>
              <TabsTrigger 
                value="machines" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Cpu className="h-4 w-4" />
                <span className="hidden sm:inline">Machines</span>
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Products</span>
              </TabsTrigger>
              <TabsTrigger 
                value="standards" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Standards</span>
              </TabsTrigger>
              <TabsTrigger 
                value="downtime" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Downtime</span>
              </TabsTrigger>
              <TabsTrigger 
                value="defects" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Ban className="h-4 w-4" />
                <span className="hidden sm:inline">Defects</span>
              </TabsTrigger>
              <TabsTrigger 
                value="planned-time" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Planned Time</span>
              </TabsTrigger>
              <TabsTrigger 
                value="permissions" 
                className="gap-2 px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Permissions</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <TabsContent value="users" className="mt-0">
                <UserManager />
              </TabsContent>

              <TabsContent value="companies" className="mt-0">
                <CompanyManager />
              </TabsContent>

              <TabsContent value="plants" className="mt-0">
                <PlantManager />
              </TabsContent>

              <TabsContent value="lines" className="mt-0">
                <LineManager />
              </TabsContent>

              <TabsContent value="machines" className="mt-0">
                <MachineManager />
              </TabsContent>

              <TabsContent value="products" className="mt-0">
                <ProductManager />
              </TabsContent>

              <TabsContent value="standards" className="mt-0">
                <ProductionStandardsManager />
              </TabsContent>

              <TabsContent value="downtime" className="mt-0">
                <DowntimeReasonManager />
              </TabsContent>

              <TabsContent value="defects" className="mt-0">
                <DefectReasonManager />
              </TabsContent>

              <TabsContent value="permissions" className="mt-0">
                <UserPermissionManager />
              </TabsContent>

              <TabsContent value="planned-time" className="mt-0">
                <PlannedTimeManager />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AppLayout>
  );
}
