import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { ScrollText, RefreshCw, Search, CalendarDays, Cpu, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navigate } from 'react-router-dom';
import { DeleteActivityDialog } from '@/components/recent-activity/DeleteActivityDialog';
import { EventTimelineEditable, type TimelineEvent } from '@/components/recent-activity/EventTimelineEditable';
import { CreateManualEventDialog } from '@/components/recent-activity/CreateManualEventDialog';

export default function RecentActivity() {
  const { user, profile, company, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [machineFilter, setMachineFilter] = useState<string>('all');
  const [deletingEvent, setDeletingEvent] = useState<TimelineEvent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const isStaff = profile?.role === 'STAFF';
  const showActor = !isStaff;
  const companyId = company?.id;

  // Compute date range from filter
  const dateRange = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (dateFilter === 'yesterday') {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    if (dateFilter === '3days') return { from: startOfDay(subDays(now, 2)), to: endOfDay(now) };
    if (dateFilter === '7days') return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    const d = new Date(dateFilter);
    if (!isNaN(d.getTime())) return { from: startOfDay(d), to: endOfDay(d) };
    return { from: startOfDay(now), to: endOfDay(now) };
  }, [dateFilter]);

  // Fetch production events directly
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['recentActivity', 'events', companyId, dateFilter, profile?.user_id],
    queryFn: async () => {
      let query = supabase
        .from('production_events')
        .select(`
          id, event_type, start_ts, end_ts, notes, machine_id, product_id, reason_id, created_by,
          machines!production_events_machine_id_fkey ( name, code ),
          products!production_events_product_id_fkey ( name, code ),
          downtime_reasons!production_events_reason_id_fkey ( name, category )
        `)
        .gte('start_ts', dateRange.from.toISOString())
        .lte('start_ts', dateRange.to.toISOString())
        .order('start_ts', { ascending: false })
        .limit(500);

      // Staff: show only own events
      if (isStaff) {
        query = query.eq('created_by', profile!.user_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch creator names for non-staff
      let creatorsMap = new Map<string, string>();
      if (showActor && data && data.length > 0) {
        const creatorIds = [...new Set(data.map(e => e.created_by))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        if (profiles) {
          creatorsMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
        }
      }

      return (data || []).map((e: any): TimelineEvent => ({
        id: e.id,
        event_type: e.event_type,
        start_ts: e.start_ts,
        end_ts: e.end_ts,
        notes: e.notes,
        machine_id: e.machine_id,
        product_id: e.product_id,
        reason_id: e.reason_id,
        created_by: e.created_by,
        machine: e.machines ? { name: e.machines.name, code: e.machines.code } : null,
        product: e.products ? { name: e.products.name, code: e.products.code } : null,
        reason: e.downtime_reasons ? { name: e.downtime_reasons.name, category: e.downtime_reasons.category } : null,
        creator: creatorsMap.has(e.created_by) ? { full_name: creatorsMap.get(e.created_by)! } : null,
      }));
    },
    enabled: !!profile,
  });

  // Unique machines for filter dropdown
  const machineOptions = useMemo(() => {
    const seen = new Map<string, { name: string; code: string }>();
    for (const e of events) {
      if (e.machine && !seen.has(e.machine_id)) {
        seen.set(e.machine_id, e.machine);
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [events]);

  // Machine + search filter
  const filteredEvents = useMemo(() => {
    let result = events;

    // Machine filter
    if (machineFilter !== 'all') {
      result = result.filter((e) => e.machine_id === machineFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        if (e.machine?.name.toLowerCase().includes(q)) return true;
        if (e.machine?.code.toLowerCase().includes(q)) return true;
        if (e.product?.name.toLowerCase().includes(q)) return true;
        if (e.product?.code.toLowerCase().includes(q)) return true;
        if (e.reason?.name.toLowerCase().includes(q)) return true;
        if (e.event_type.toLowerCase().includes(q)) return true;
        if (e.creator?.full_name.toLowerCase().includes(q)) return true;
        if (e.notes?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return result;
  }, [events, machineFilter, searchQuery]);

  // Group by machine
  const groupedByMachine = useMemo(() => {
    const groups = new Map<string, { machine: { name: string; code: string } | null; events: TimelineEvent[] }>();
    for (const event of filteredEvents) {
      const key = event.machine_id;
      if (!groups.has(key)) {
        groups.set(key, { machine: event.machine, events: [] });
      }
      groups.get(key)!.events.push(event);
    }
    return groups;
  }, [filteredEvents]);

  // Can edit?
  const canEdit = (event: TimelineEvent): boolean => {
    if (profile?.role === 'ADMIN' || profile?.role === 'SUPERVISOR') return true;
    return event.created_by === profile?.user_id;
  };

  const editable = useMemo(() => {
    // All events are editable based on user role
    return events.some(e => canEdit(e));
  }, [events, profile]);

  const handleDelete = (event: TimelineEvent) => {
    setDeletingEvent(event);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ScrollText className="h-6 w-6" />
                Timeline เหตุการณ์การผลิต
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isStaff
                  ? 'ตรวจสอบและแก้ไขเหตุการณ์การผลิตของคุณ'
                  : 'ตรวจสอบและแก้ไขเหตุการณ์การผลิตทั้งหมด — คลิกที่เวลาเพื่อแก้ไข'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                สร้าง Manual
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> วันที่
              </Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">วันนี้</SelectItem>
                  <SelectItem value="yesterday">เมื่อวาน</SelectItem>
                  <SelectItem value="3days">3 วันล่าสุด</SelectItem>
                  <SelectItem value="7days">7 วันล่าสุด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">หรือเลือกวัน</Label>
              <Input
                type="date"
                className="w-40 h-9"
                value={dateFilter.match(/^\d{4}-\d{2}-\d{2}$/) ? dateFilter : ''}
                onChange={(e) => {
                  if (e.target.value) setDateFilter(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Cpu className="h-3 w-3" /> เครื่องจักร
              </Label>
              <Select value={machineFilter} onValueChange={setMachineFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกเครื่อง ({machineOptions.length})</SelectItem>
                  {machineOptions.map(([id, m]) => (
                    <SelectItem key={id} value={id}>
                      {m.name} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <Label className="text-xs flex items-center gap-1">
                <Search className="h-3 w-3" /> ค้นหา
              </Label>
              <Input
                placeholder="ชื่อเครื่อง, สินค้า, ผู้ใช้..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Timeline ล่าสุด
                  <Badge variant="secondary" className="text-xs">{filteredEvents.length} เหตุการณ์</Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Cpu className="h-3 w-3" />
                    {groupedByMachine.size} เครื่อง
                  </Badge>
                </span>
                {isStaff && (
                  <Badge variant="secondary" className="text-xs">
                    แสดงเฉพาะของคุณ
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-340px)] min-h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ScrollText className="h-12 w-12 mb-4 opacity-50" />
                    <p>ไม่พบเหตุการณ์การผลิต</p>
                  </div>
                ) : (
                  <div className="space-y-6 pr-3">
                    {[...groupedByMachine.entries()].map(([machineId, group]) => (
                      <div key={machineId}>
                        {/* Machine header */}
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-3 flex items-center gap-2 border-b border-border/50 pb-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            {group.machine?.name || 'Unknown'}
                          </span>
                          {group.machine?.code && (
                            <span className="text-xs font-mono text-muted-foreground">
                              ({group.machine.code})
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {group.events.length} events
                          </Badge>
                        </div>

                        {/* Timeline */}
                        <EventTimelineEditable
                          events={group.events}
                          editable={profile?.role === 'ADMIN' || profile?.role === 'SUPERVISOR' || isStaff}
                          showActor={showActor}
                          onDelete={handleDelete}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Dialog */}
      {deletingEvent && (
        <DeleteActivityDialog
          open={!!deletingEvent}
          onOpenChange={(open) => !open && setDeletingEvent(null)}
          entityType="production_events"
          entityId={deletingEvent.id}
          description="คุณต้องการลบเหตุการณ์การผลิตนี้ใช่หรือไม่?"
        />
      )}

      {/* Create Manual Event Dialog */}
      <CreateManualEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        companyId={companyId}
      />
    </div>
  );
}
