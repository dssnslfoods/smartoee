import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { History, RefreshCw, ChevronDown, ChevronRight, Search, Calendar, Filter } from 'lucide-react';
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  production_events: 'Production Event',
  production_counts: 'Production Count',
  shift_approvals: 'Shift Approval',
  oee_snapshots: 'OEE Snapshot',
  machines: 'Machine',
  lines: 'Line',
  plants: 'Plant',
  products: 'Product',
  production_standards: 'Production Standard',
  shifts: 'Shift',
  downtime_reasons: 'Downtime Reason',
  defect_reasons: 'Defect Reason',
};

function getActionBadge(action: string) {
  switch (action) {
    case 'INSERT':
      return <Badge className="bg-status-running/10 text-status-running border-status-running/20">INSERT</Badge>;
    case 'UPDATE':
      return <Badge className="bg-primary/10 text-primary border-primary/20">UPDATE</Badge>;
    case 'DELETE':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">DELETE</Badge>;
    default:
      return <Badge variant="secondary">{action}</Badge>;
  }
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = log.before_json || log.after_json;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer">
            <div className="flex items-start gap-3">
              {hasDetails ? (
                isOpen ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
              ) : (
                <div className="w-4" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(log.action)}
                  <span className="font-medium text-sm">{ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  โดย: {log.actor_name || 'ระบบ'}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
              <div>{format(new Date(log.ts), 'dd MMM yyyy', { locale: th })}</div>
              <div>{format(new Date(log.ts), 'HH:mm:ss')}</div>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {hasDetails && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {log.before_json && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Before:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(log.before_json, null, 2)}
                  </pre>
                </div>
              )}
              {log.after_json && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">After:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(log.after_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function ActivityLog() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isStaff = profile?.role === 'STAFF';

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['activityLogs', dateFrom, dateTo, entityTypeFilter, actionFilter, profile?.user_id],
    queryFn: async () => {
      let query = supabase
        .from('v_audit_logs_readable')
        .select('*')
        .gte('ts', `${dateFrom}T00:00:00`)
        .lte('ts', `${dateTo}T23:59:59`)
        .order('ts', { ascending: false })
        .limit(500);

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

  // Client-side search filter
  const filteredLogs = searchQuery.trim()
    ? logs.filter(
        (log) =>
          log.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  // Get unique entity types from logs for filter
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
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6" />
                Activity Log
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isStaff ? 'ประวัติการทำงานของคุณ' : 'ประวัติการทำงานทั้งหมดในระบบ'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> จากวันที่
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> ถึงวันที่
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
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
                      <SelectItem value="INSERT">INSERT</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[180px]">
                  <Label className="text-xs flex items-center gap-1">
                    <Search className="h-3 w-3" /> ค้นหา
                  </Label>
                  <Input
                    placeholder="ค้นหาชื่อผู้ใช้, ประเภท..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>ผลลัพธ์ ({filteredLogs.length} รายการ)</span>
                {isStaff && (
                  <Badge variant="secondary" className="text-xs">
                    แสดงเฉพาะของคุณ
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mb-4 opacity-50" />
                    <p>ไม่พบ Activity Log ในช่วงเวลาที่เลือก</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-3">
                    {filteredLogs.map((log) => (
                      <AuditLogItem key={log.id} log={log} />
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
