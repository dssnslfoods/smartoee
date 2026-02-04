import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { OEEGauge } from '@/components/dashboard/OEEGauge';
import { MachineStatusCard } from '@/components/dashboard/MachineStatusCard';
import { OEETrendChart } from '@/components/dashboard/OEETrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OEECardSkeleton, StatsCardSkeleton, MachineCardSkeleton, ChartCardSkeleton } from '@/components/ui/skeletons';
import { Calendar, Factory, TrendingUp, AlertTriangle, LayoutDashboard, Play, Pause, Wrench, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

// Mock data - will be replaced with Supabase queries filtered by company
const mockOEEData = {
  availability: 87.5,
  performance: 92.3,
  quality: 98.1,
  oee: 79.2,
};

const mockMachines = [
  { name: 'CNC Machine 01', code: 'CNC-001', status: 'running' as const, oee: 85.2, currentProduct: 'Part A-001' },
  { name: 'CNC Machine 02', code: 'CNC-002', status: 'idle' as const, oee: 72.4, currentProduct: undefined },
  { name: 'Press Machine 01', code: 'PRS-001', status: 'running' as const, oee: 91.8, currentProduct: 'Part B-003' },
  { name: 'Assembly Line 01', code: 'ASM-001', status: 'maintenance' as const, oee: 0, currentProduct: undefined },
  { name: 'CNC Machine 03', code: 'CNC-003', status: 'stopped' as const, oee: 45.2, currentProduct: 'Part A-002' },
  { name: 'Press Machine 02', code: 'PRS-002', status: 'running' as const, oee: 88.3, currentProduct: 'Part C-001' },
];

const mockTrendData = [
  { date: 'Mon', availability: 85, performance: 90, quality: 97, oee: 74 },
  { date: 'Tue', availability: 88, performance: 92, quality: 98, oee: 79 },
  { date: 'Wed', availability: 82, performance: 88, quality: 96, oee: 69 },
  { date: 'Thu', availability: 90, performance: 94, quality: 99, oee: 84 },
  { date: 'Fri', availability: 87, performance: 91, quality: 98, oee: 78 },
  { date: 'Sat', availability: 89, performance: 93, quality: 97, oee: 80 },
  { date: 'Sun', availability: 86, performance: 90, quality: 98, oee: 76 },
];

export default function Dashboard() {
  const { company, isAdmin } = useAuth();

  // Company context for data filtering (will be used when connected to real data)
  const companyId = company?.id;
  const companyName = company?.name;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        {/* Header */}
        <PageHeader 
          title="OEE Dashboard" 
          description="Real-time production performance monitoring"
          icon={LayoutDashboard}
        >
          {/* Company indicator for admin users */}
          {isAdmin() && company && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 border-primary/20">
              <Building2 className="h-3.5 w-3.5" />
              {companyName}
            </Badge>
          )}
          <Select defaultValue="today">
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-background">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-background">
              <Factory className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              <SelectItem value="line1">Line 1</SelectItem>
              <SelectItem value="line2">Line 2</SelectItem>
              <SelectItem value="line3">Line 3</SelectItem>
            </SelectContent>
          </Select>
        </PageHeader>

        {/* OEE Summary Cards */}
        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-l-4 border-l-oee-availability">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <OEEGauge value={mockOEEData.availability} label="" color="availability" size="sm" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Availability</p>
                  <p className="text-xl sm:text-2xl font-bold text-oee-availability">
                    {mockOEEData.availability}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-oee-performance">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <OEEGauge value={mockOEEData.performance} label="" color="performance" size="sm" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Performance</p>
                  <p className="text-xl sm:text-2xl font-bold text-oee-performance">
                    {mockOEEData.performance}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-oee-quality">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <OEEGauge value={mockOEEData.quality} label="" color="quality" size="sm" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Quality</p>
                  <p className="text-xl sm:text-2xl font-bold text-oee-quality">
                    {mockOEEData.quality}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-oee-overall bg-gradient-to-br from-card to-accent/30">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <OEEGauge value={mockOEEData.oee} label="" color="overall" size="sm" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Overall OEE</p>
                  <p className="text-xl sm:text-2xl font-bold text-oee-overall">
                    {mockOEEData.oee}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="transition-all hover:shadow-md">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-running/10">
                <Play className="h-5 w-5 sm:h-6 sm:w-6 text-status-running" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold">4</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Machines Running</p>
              </div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-idle/10">
                <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-status-idle" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold">1</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Machines Idle</p>
              </div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-stopped/10">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-status-stopped" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold">1</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Machines Stopped</p>
              </div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-status-maintenance/10">
                <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-status-maintenance" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold">1</p>
                <p className="text-xs sm:text-sm text-muted-foreground">In Maintenance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Machine Grid */}
        <div className="grid gap-5 lg:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OEETrendChart data={mockTrendData} title="Weekly OEE Trend" />
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg font-semibold">Machine Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockMachines.slice(0, 4).map((machine) => (
                <MachineStatusCard key={machine.code} {...machine} compact />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* All Machines Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">All Machines</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {mockMachines.map((machine) => (
              <MachineStatusCard key={machine.code} {...machine} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
