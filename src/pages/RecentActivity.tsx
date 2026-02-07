import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInSeconds } from 'date-fns';
import { th } from 'date-fns/locale';
import { ScrollText, RefreshCw, ChevronDown, ChevronRight, Search, Filter, Clock, User, Play, Pause, Wrench, Package, Cpu, Hash } from 'lucide-react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Play; colorClass: string; bgClass: string }> = {
  RUN: { label: 'Running', icon: Play, colorClass: 'text-status-running', bgClass: 'bg-status-running/10 border-status-running/20' },
  DOWNTIME: { label: 'Downtime', icon: Pause, colorClass: 'text-destructive', bgClass: 'bg-destructive/10 border-destructive/20' },
  SETUP: { label: 'Setup', icon: Wrench, colorClass: 'text-warning', bgClass: 'bg-warning/10 border-warning/20' },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function getActionBadge(action: string) {
  switch (action) {
    case 'INSERT':
      return <Badge className="bg-status-running/10 text-status-running border-status-running/20 text-xs">{ACTION_LABELS[action]}</Badge>;
    case 'UPDATE':
      return <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{ACTION_LABELS[action]}</Badge>;
    case 'DELETE':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">{ACTION_LABELS[action]}</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{action}</Badge>;
  }
}

// --- Production Event Detail Card ---
function ProductionEventDetail({ log, lookup }: { log: AuditLog; lookup: LookupData }) {
  const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;
  if (!data) return null;

  const eventType = data.event_type as string;
  const config = EVENT_TYPE_CONFIG[eventType];
  const Icon = config?.icon || Play;
  const machineId = data.machine_id as string;
  const productId = data.product_id as string | null;
  const reasonId = data.reason_id as string | null;
  const startTs = data.start_ts as string | null;
  const endTs = data.end_ts as string | null;
  const notes = data.notes as string | null;

  const machine = lookup.machines.get(machineId);
  const product = productId ? lookup.products.get(productId) : null;
  const reason = reasonId ? lookup.reasons.get(reasonId) : null;

  const duration = startTs && endTs
    ? differenceInSeconds(new Date(endTs), new Date(startTs))
    : null;

  const isOngoing = startTs && !endTs && log.action !== 'DELETE';

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', config?.bgClass || 'bg-muted/30')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn('flex items-center gap-1.5', config?.colorClass)}>
          <Icon className="h-4 w-4" />
          <span className="font-semibold text-sm">{config?.label || eventType}</span>
        </div>
        {isOngoing && (
          <Badge variant="outline" className="text-[10px] animate-pulse border-status-running/40 text-status-running">
            กำลังดำเนินการ
          </Badge>
        )}
        {duration != null && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(duration)}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {machine && (
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {machine.name} <span className="font-mono text-[10px]">({machine.code})</span>
          </span>
        )}
        {product && (
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {product.name} <span className="font-mono text-[10px]">({product.code})</span>
          </span>
        )}
        {reason && (
          <span className="flex items-center gap-1">
            📋 {reason.name} <span className="text-[10px]">({reason.category})</span>
          </span>
        )}
      </div>

      {startTs && (
        <div className="text-xs text-muted-foreground">
          {format(new Date(startTs), 'HH:mm:ss')}
          {endTs && ` → ${format(new Date(endTs), 'HH:mm:ss')}`}
        </div>
      )}
      {notes && <p className="text-xs text-muted-foreground italic">📝 {notes}</p>}
    </div>
  );
}

// --- Production Count Detail Card ---
function ProductionCountDetail({ log, lookup }: { log: AuditLog; lookup: LookupData }) {
  const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;
  if (!data) return null;

  const machineId = data.machine_id as string;
  const goodQty = data.good_qty as number;
  const rejectQty = data.reject_qty as number;
  const notes = data.notes as string | null;
  const machine = lookup.machines.get(machineId);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Hash className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">บันทึกจำนวน</span>
        <Badge className="bg-status-running/10 text-status-running border-status-running/20 text-xs">
          ✓ {goodQty ?? 0}
        </Badge>
        {(rejectQty ?? 0) > 0 && (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
            ✗ {rejectQty}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {machine && (
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {machine.name} <span className="font-mono text-[10px]">({machine.code})</span>
          </span>
        )}
      </div>
      {notes && <p className="text-xs text-muted-foreground italic">📝 {notes}</p>}
    </div>
  );
}

// --- Generic Detail (fallback) ---
function GenericDetail({ log }: { log: AuditLog }) {
  const hasDetails = log.before_json || log.after_json;
  if (!hasDetails) return null;

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      {log.before_json && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">ก่อนแก้ไข:</div>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
            {JSON.stringify(log.before_json, null, 2)}
          </pre>
        </div>
      )}
      {log.after_json && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">หลังแก้ไข:</div>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
            {JSON.stringify(log.after_json, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// --- Main Activity Item ---
function RecentActivityItem({ log, showActor, lookup }: { log: AuditLog; showActor: boolean; lookup: LookupData }) {
  const [isOpen, setIsOpen] = useState(false);

  const isProductionEvent = log.entity_type === 'production_events';
  const isProductionCount = log.entity_type === 'production_counts';
  const hasRichDetail = isProductionEvent || isProductionCount;
  const hasGenericDetail = !hasRichDetail && (log.before_json || log.after_json);

  const summary = useMemo(() => {
    const entityLabel = ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type;
    const actionLabel = ACTION_LABELS[log.action] || log.action;

    // Enrich summary for production events
    if (isProductionEvent) {
      const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;
      const eventType = data?.event_type as string;
      const config = EVENT_TYPE_CONFIG[eventType];
      const machineId = data?.machine_id as string;
      const machine = lookup.machines.get(machineId);
      return `${actionLabel} ${config?.label || eventType || 'Event'}${machine ? ` — ${machine.name}` : ''}`;
    }

    if (isProductionCount) {
      const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;
      const machineId = data?.machine_id as string;
      const machine = lookup.machines.get(machineId);
      const good = data?.good_qty as number ?? 0;
      const reject = data?.reject_qty as number ?? 0;
      return `${actionLabel} จำนวนผลิต (✓${good} ✗${reject})${machine ? ` — ${machine.name}` : ''}`;
    }

    return `${actionLabel} ${entityLabel}`;
  }, [log, lookup, isProductionEvent, isProductionCount]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              {(hasRichDetail || hasGenericDetail) ? (
                isOpen ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(log.action)}
                  {isProductionEvent && (() => {
                    const data = (log.action === 'DELETE' ? log.before_json : log.after_json) as Record<string, unknown> | null;
                    const et = data?.event_type as string;
                    const cfg = EVENT_TYPE_CONFIG[et];
                    if (!cfg) return null;
                    const EtIcon = cfg.icon;
                    return <EtIcon className={cn('h-3.5 w-3.5', cfg.colorClass)} />;
                  })()}
                  <span className="font-medium text-sm">{summary}</span>
                </div>
                {showActor && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {log.actor_name || 'ระบบ'}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right whitespace-nowrap shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <div>
                <div>{format(new Date(log.ts), 'dd MMM yy', { locale: th })}</div>
                <div>{format(new Date(log.ts), 'HH:mm:ss')}</div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3">
            {isProductionEvent && <ProductionEventDetail log={log} lookup={lookup} />}
            {isProductionCount && <ProductionCountDetail log={log} lookup={lookup} />}
            {!hasRichDetail && <GenericDetail log={log} />}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function RecentActivity() {
  const { user, profile, company, isLoading: authLoading } = useAuth();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isStaff = profile?.role === 'STAFF';
  const showActor = !isStaff;
  const companyId = company?.id;

  // Fetch lookup data for machines, products, reasons
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
    queryKey: ['recentActivity', entityTypeFilter, actionFilter, profile?.user_id],
    queryFn: async () => {
      let query = supabase
        .from('v_audit_logs_readable')
        .select('*')
        .order('ts', { ascending: false })
        .limit(200);

      if (entityTypeFilter !== 'all') {
        query = query.eq('entity_type', entityTypeFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!profile,
  });

  // Client-side search filter (includes machine/product names)
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      if (log.actor_name?.toLowerCase().includes(q)) return true;
      if ((ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type).toLowerCase().includes(q)) return true;

      // Search in machine/product names from after_json
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
  }, [logs, searchQuery, lookup]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AuditLog[]>();
    for (const log of filteredLogs) {
      const dateKey = format(new Date(log.ts), 'yyyy-MM-dd');
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(log);
    }
    return groups;
  }, [filteredLogs]);

  const entityTypes = [...new Set(logs.map((l) => l.entity_type))].sort();

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

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> ประเภท
              </Label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ENTITY_TYPE_LABELS[t] || t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> Action
              </Label>
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
                <span>กิจกรรมล่าสุด ({filteredLogs.length})</span>
                {isStaff && (
                  <Badge variant="secondary" className="text-xs">
                    แสดงเฉพาะของคุณ
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-320px)] min-h-[300px]">
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
                  <div className="space-y-4 pr-3">
                    {[...groupedByDate.entries()].map(([dateKey, dateLogs]) => (
                      <div key={dateKey}>
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {format(new Date(dateKey), 'EEEE dd MMMM yyyy', { locale: th })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">({dateLogs.length})</span>
                        </div>
                        <div className="space-y-2">
                          {dateLogs.map((log) => (
                            <RecentActivityItem key={log.id} log={log} showActor={showActor} lookup={lookup} />
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
    </div>
  );
}
