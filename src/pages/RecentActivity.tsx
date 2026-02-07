import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ScrollText, RefreshCw, Search, Clock } from 'lucide-react';
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
import { EntityTypeChips, matchesChipFilter } from '@/components/recent-activity/EntityTypeChips';
import { EditEventDialog } from '@/components/recent-activity/EditEventDialog';
import { EditCountDialog } from '@/components/recent-activity/EditCountDialog';
import { DeleteActivityDialog } from '@/components/recent-activity/DeleteActivityDialog';
import { ActivitySessionCard } from '@/components/recent-activity/ActivitySessionCard';
import { groupActivitiesIntoSessions } from '@/components/recent-activity/groupActivities';

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  actor_name: string | null;
  actor_user_id: string | null;
  ts: string;
}

interface LookupData {
  machines: Map<string, { name: string; code: string }>;
  products: Map<string, { name: string; code: string }>;
  reasons: Map<string, { name: string; category: string }>;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  production_events: 'เหตุการณ์การผลิต',
  production_counts: 'บันทึกจำนวนผลิต',
  shift_approvals: 'อนุมัติกะ',
  oee_snapshots: 'OEE Snapshot',
  machines: 'เครื่องจักร',
  lines: 'ไลน์',
  plants: 'โรงงาน',
  products: 'สินค้า',
  production_standards: 'มาตรฐานการผลิต',
  shifts: 'กะการทำงาน',
  downtime_reasons: 'สาเหตุหยุดเครื่อง',
  defect_reasons: 'สาเหตุของเสีย',
};

const EDITABLE_TYPES = new Set(['production_events', 'production_counts']);

function canEditLog(log: AuditLog, userId: string | undefined, role: string | undefined): boolean {
  if (!EDITABLE_TYPES.has(log.entity_type)) return false;
  if (log.action === 'DELETE') return false;
  if (role === 'ADMIN' || role === 'SUPERVISOR') return true;
  return log.actor_user_id === userId;
}

export default function RecentActivity() {
  const { user, profile, company, isLoading: authLoading } = useAuth();
  const [chipFilter, setChipFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingEvent, setEditingEvent] = useState<AuditLog | null>(null);
  const [editingCount, setEditingCount] = useState<AuditLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<AuditLog | null>(null);

  const isStaff = profile?.role === 'STAFF';
  const showActor = !isStaff;
  const companyId = company?.id;

  // Lookup data
  const { data: machinesData = [] } = useQuery({
    queryKey: ['ra-machines', companyId],
    queryFn: async () => {
      let q = supabase.from('machines').select('id, name, code').eq('is_active', true);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: productsData = [] } = useQuery({
    queryKey: ['ra-products', companyId],
    queryFn: async () => {
      let q = supabase.from('products').select('id, name, code').eq('is_active', true);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: reasonsData = [] } = useQuery({
    queryKey: ['ra-reasons', companyId],
    queryFn: async () => {
      let q = supabase.from('downtime_reasons').select('id, name, category').eq('is_active', true);
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const lookup: LookupData = useMemo(() => ({
    machines: new Map(machinesData.map(m => [m.id, { name: m.name, code: m.code }])),
    products: new Map(productsData.map(p => [p.id, { name: p.name, code: p.code }])),
    reasons: new Map(reasonsData.map(r => [r.id, { name: r.name, category: r.category }])),
  }), [machinesData, productsData, reasonsData]);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['recentActivity', actionFilter, profile?.user_id],
    queryFn: async () => {
      let query = supabase
        .from('v_audit_logs_readable')
        .select('*')
        .order('ts', { ascending: false })
        .limit(300);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!profile,
  });

  // Apply chip filter + search
  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) =>
      matchesChipFilter(chipFilter, log.entity_type, log.after_json, log.before_json)
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((log) => {
        if (log.actor_name?.toLowerCase().includes(q)) return true;
        if ((ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type).toLowerCase().includes(q)) return true;
        const data = log.after_json || log.before_json;
        if (data) {
          const machineId = data.machine_id as string;
          const productId = data.product_id as string;
          const machine = machineId ? lookup.machines.get(machineId) : null;
          const product = productId ? lookup.products.get(productId) : null;
          if (machine && (machine.name.toLowerCase().includes(q) || machine.code.toLowerCase().includes(q))) return true;
          if (product && (product.name.toLowerCase().includes(q) || product.code.toLowerCase().includes(q))) return true;
        }
        return false;
      });
    }
    return result;
  }, [logs, chipFilter, searchQuery, lookup]);

  // Group into sessions
  const sessions = useMemo(() => groupActivitiesIntoSessions(filteredLogs), [filteredLogs]);

  // Group sessions by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const dateKey = format(new Date(session.endTs), 'yyyy-MM-dd');
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(session);
    }
    return groups;
  }, [sessions]);

  // Handlers
  const handleEdit = (log: AuditLog) => {
    if (log.entity_type === 'production_events') {
      setEditingEvent(log);
    } else if (log.entity_type === 'production_counts') {
      setEditingCount(log);
    }
  };

  const handleDelete = (log: AuditLog) => {
    setDeletingLog(log);
  };

  const getEditEventData = (log: AuditLog) => {
    const data = log.after_json || log.before_json;
    return {
      event_type: (data?.event_type as string) || 'RUN',
      start_ts: (data?.start_ts as string) || '',
      end_ts: (data?.end_ts as string) || null,
      notes: (data?.notes as string) || null,
    };
  };

  const getEditCountData = (log: AuditLog) => {
    const data = log.after_json || log.before_json;
    return {
      good_qty: (data?.good_qty as number) ?? 0,
      reject_qty: (data?.reject_qty as number) ?? 0,
      notes: (data?.notes as string) || null,
    };
  };

  const getMachineName = (log: AuditLog) => {
    const data = log.after_json || log.before_json;
    const machineId = data?.machine_id as string;
    return machineId ? lookup.machines.get(machineId)?.name : undefined;
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
                Recent Activity
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isStaff ? 'ตรวจสอบสิ่งที่คุณบันทึกล่าสุด' : 'ตรวจสอบกิจกรรมล่าสุดของทุกคน'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>

          {/* Toggle Chips Filter */}
          <EntityTypeChips selected={chipFilter} onSelect={setChipFilter} />

          {/* Secondary filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="INSERT">สร้าง</SelectItem>
                  <SelectItem value="UPDATE">แก้ไข</SelectItem>
                  <SelectItem value="DELETE">ลบ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <Label className="text-xs flex items-center gap-1">
                <Search className="h-3 w-3" /> ค้นหา
              </Label>
              <Input
                placeholder="ค้นหาชื่อเครื่อง, สินค้า, ผู้ใช้..."
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
                  กิจกรรมล่าสุด
                  <Badge variant="secondary" className="text-xs">{filteredLogs.length} รายการ</Badge>
                  {sessions.length !== filteredLogs.length && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      {sessions.length} เซสชัน
                    </Badge>
                  )}
                </span>
                {isStaff && (
                  <Badge variant="secondary" className="text-xs">
                    แสดงเฉพาะของคุณ
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ScrollText className="h-12 w-12 mb-4 opacity-50" />
                    <p>ไม่พบกิจกรรมล่าสุด</p>
                  </div>
                ) : (
                  <div className="space-y-5 pr-3">
                    {[...groupedByDate.entries()].map(([dateKey, dateSessions]) => (
                      <div key={dateKey}>
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {format(new Date(dateKey), 'EEEE dd MMMM yyyy', { locale: th })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({dateSessions.reduce((sum, s) => sum + s.logs.length, 0)})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dateSessions.map((session) => (
                            <ActivitySessionCard
                              key={session.key}
                              session={session}
                              showActor={showActor}
                              lookup={lookup}
                              canEditFn={(log) => canEditLog(log, profile?.user_id, profile?.role)}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Event Dialog */}
      {editingEvent && (
        <EditEventDialog
          open={!!editingEvent}
          onOpenChange={(open) => !open && setEditingEvent(null)}
          entityId={editingEvent.entity_id}
          initialData={getEditEventData(editingEvent)}
          machineName={getMachineName(editingEvent)}
        />
      )}

      {/* Edit Count Dialog */}
      {editingCount && (
        <EditCountDialog
          open={!!editingCount}
          onOpenChange={(open) => !open && setEditingCount(null)}
          entityId={editingCount.entity_id}
          initialData={getEditCountData(editingCount)}
          machineName={getMachineName(editingCount)}
        />
      )}

      {/* Delete Dialog */}
      {deletingLog && (
        <DeleteActivityDialog
          open={!!deletingLog}
          onOpenChange={(open) => !open && setDeletingLog(null)}
          entityType={deletingLog.entity_type}
          entityId={deletingLog.entity_id}
          description={`คุณต้องการลบรายการ "${ENTITY_TYPE_LABELS[deletingLog.entity_type] || deletingLog.entity_type}" นี้ใช่หรือไม่?`}
        />
      )}
    </div>
  );
}
