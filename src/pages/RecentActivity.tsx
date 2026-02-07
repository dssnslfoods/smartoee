import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ScrollText, RefreshCw, ChevronDown, ChevronRight, Search, Filter, Clock, User } from 'lucide-react';
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

function RecentActivityItem({ log, showActor }: { log: AuditLog; showActor: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = log.before_json || log.after_json;

  // Build a human-readable summary
  const summary = useMemo(() => {
    const entityLabel = ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type;
    const actionLabel = ACTION_LABELS[log.action] || log.action;
    return `${actionLabel} ${entityLabel}`;
  }, [log]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              {hasDetails ? (
                isOpen ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(log.action)}
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
          {hasDetails && (
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
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function RecentActivity() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isStaff = profile?.role === 'STAFF';
  const showActor = !isStaff; // Admin/Supervisor see who did it

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['recentActivity', entityTypeFilter, actionFilter, profile?.user_id],
    queryFn: async () => {
      // Fetch recent 200 entries (RLS handles scoping)
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

  // Client-side search filter
  const filteredLogs = searchQuery.trim()
    ? logs.filter(
        (log) =>
          log.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type).toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

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
                placeholder="ค้นหา..."
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
                            <RecentActivityItem key={log.id} log={log} showActor={showActor} />
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
