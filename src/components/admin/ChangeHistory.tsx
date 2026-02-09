import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  ts: string;
  action: string;
  actor_name: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
}

interface ChangeHistoryProps {
  entityType: string;
  title?: string;
  /** Which fields to display in the diff. If omitted, shows all changed fields */
  displayFields?: Record<string, string>; // field_name -> display label
}

function getActionBadge(action: string) {
  switch (action) {
    case 'INSERT':
      return <Badge variant="default" className="text-xs">สร้าง</Badge>;
    case 'UPDATE':
      return <Badge variant="secondary" className="text-xs">แก้ไข</Badge>;
    case 'DELETE':
      return <Badge variant="destructive" className="text-xs">ลบ</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{action}</Badge>;
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'ใช่' : 'ไม่';
  if (typeof val === 'number') return String(val);
  return String(val);
}

function getChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  displayFields?: Record<string, string>
): { field: string; label: string; before: string; after: string }[] {
  if (!before && !after) return [];

  const skipFields = ['id', 'created_at', 'updated_at'];
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  const changes: { field: string; label: string; before: string; after: string }[] = [];

  allKeys.forEach((key) => {
    if (skipFields.includes(key)) return;
    if (displayFields && !(key in displayFields)) return;

    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({
        field: key,
        label: displayFields?.[key] || key,
        before: formatValue(beforeVal),
        after: formatValue(afterVal),
      });
    }
  });

  return changes;
}

export function ChangeHistory({ entityType, title, displayFields }: ChangeHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['change-history', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_audit_logs_readable')
        .select('*')
        .eq('entity_type', entityType)
        .order('ts', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isExpanded,
  });

  return (
    <div className="rounded-lg border bg-muted/20">
      <Button
        variant="ghost"
        className="w-full justify-between px-4 py-3 h-auto"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title || 'ประวัติการเปลี่ยนแปลง'}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.map((log) => {
                const changes = getChangedFields(
                  log.before_json as Record<string, unknown> | null,
                  log.after_json as Record<string, unknown> | null,
                  displayFields
                );

                return (
                  <div key={log.id} className="rounded-md border bg-background p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="text-xs text-muted-foreground">
                          โดย {log.actor_name || 'ระบบ'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(log.ts), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>

                    {changes.length > 0 && (
                      <div className="space-y-0.5 mt-1">
                        {changes.map((c) => (
                          <div key={c.field} className="text-xs flex items-center gap-1 flex-wrap">
                            <span className="font-medium text-muted-foreground">{c.label}:</span>
                            {log.action === 'INSERT' ? (
                              <span className="text-primary">{c.after}</span>
                            ) : log.action === 'DELETE' ? (
                              <span className="line-through text-destructive">{c.before}</span>
                            ) : (
                              <>
                                <span className="line-through text-muted-foreground">{c.before}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-primary">{c.after}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {log.action === 'INSERT' && changes.length === 0 && (
                      <p className="text-xs text-muted-foreground">สร้างรายการใหม่</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
          )}
        </div>
      )}
    </div>
  );
}
