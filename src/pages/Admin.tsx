import { Link, Navigate } from 'react-router-dom';
import { Settings, ArrowLeft, Factory, Layers, Cpu, AlertTriangle, Ban, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import {
  PlantManager,
  LineManager,
  MachineManager,
  DowntimeReasonManager,
  DefectReasonManager,
  UserPermissionManager,
} from '@/components/admin';

export default function Admin() {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = hasRole('admin');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <Ban className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the Admin Setup page.
            </p>
            <Link to="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Settings className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Setup</h1>
              <p className="text-muted-foreground">Manage master data and permissions</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="plants" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="plants" className="gap-2">
              <Factory className="h-4 w-4 hidden sm:block" />
              Plants
            </TabsTrigger>
            <TabsTrigger value="lines" className="gap-2">
              <Layers className="h-4 w-4 hidden sm:block" />
              Lines
            </TabsTrigger>
            <TabsTrigger value="machines" className="gap-2">
              <Cpu className="h-4 w-4 hidden sm:block" />
              Machines
            </TabsTrigger>
            <TabsTrigger value="downtime" className="gap-2">
              <AlertTriangle className="h-4 w-4 hidden sm:block" />
              Downtime
            </TabsTrigger>
            <TabsTrigger value="defects" className="gap-2">
              <Ban className="h-4 w-4 hidden sm:block" />
              Defects
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <Card>
            <CardContent className="p-6">
              <TabsContent value="plants" className="mt-0">
                <PlantManager />
              </TabsContent>

              <TabsContent value="lines" className="mt-0">
                <LineManager />
              </TabsContent>

              <TabsContent value="machines" className="mt-0">
                <MachineManager />
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
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
