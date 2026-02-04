import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { RefreshCw, ChevronDown, ChevronRight, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

interface AuditLogViewerProps {
  plantId: string;
  date: string;
}

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

export function AuditLogViewer({ plantId, date }: AuditLogViewerProps) {
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', plantId, date],
    queryFn: async () => {
      const startDate = `${date}T00:00:00`;
      const endDate = `${date}T23:59:59`;
      
      const { data, error } = await supabase
        .from('v_audit_logs_readable')
        .select('*')
        .gte('ts', startDate)
        .lte('ts', endDate)
        .order('ts', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!plantId && !!date,
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Badge className="bg-green-500/10 text-green-600">INSERT</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-500/10 text-blue-600">UPDATE</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-500/10 text-red-600">DELETE</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getEntityTypeName = (type: string) => {
    const names: Record<string, string> = {
      production_events: 'Production Event',
      production_counts: 'Production Count',
      shift_approvals: 'Shift Approval',
      oee_snapshots: 'OEE Snapshot',
    };
    return names[type] || type;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Log
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p>ไม่พบ Audit Log สำหรับวันที่เลือก</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <AuditLogItem key={log.id} log={log} getActionBadge={getActionBadge} getEntityTypeName={getEntityTypeName} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface AuditLogItemProps {
  log: AuditLog;
  getActionBadge: (action: string) => React.ReactNode;
  getEntityTypeName: (type: string) => string;
}

function AuditLogItem({ log, getActionBadge, getEntityTypeName }: AuditLogItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasDetails = log.before_json || log.after_json;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between cursor-pointer">
            <div className="flex items-start gap-3">
              {hasDetails ? (
                isOpen ? (
                  <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
                )
              ) : (
                <div className="w-4" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(log.action)}
                  <span className="font-medium">{getEntityTypeName(log.entity_type)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  โดย: {log.actor_name || 'ระบบ'}
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground text-right">
              {format(new Date(log.ts), 'HH:mm:ss', { locale: th })}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {hasDetails && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {log.before_json && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Before:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.before_json, null, 2)}
                  </pre>
                </div>
              )}
              {log.after_json && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">After:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
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
