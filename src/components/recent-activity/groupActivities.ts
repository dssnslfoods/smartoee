/**
 * Groups audit logs into "sessions" — consecutive entries from the same actor
 * on the same machine within a time window (default 30 minutes).
 */

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

export interface ActivitySession {
  /** Unique key for React rendering */
  key: string;
  /** The actor who performed these actions */
  actorName: string | null;
  actorUserId: string | null;
  /** Machine ID if all entries share one, otherwise null */
  machineId: string | null;
  /** Earliest timestamp in the session */
  startTs: string;
  /** Latest timestamp in the session */
  endTs: string;
  /** Individual log entries, ordered by ts descending (newest first) */
  logs: AuditLog[];
}

const MACHINE_ENTITY_TYPES = new Set(['production_events', 'production_counts']);
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

function getMachineId(log: AuditLog): string | null {
  if (!MACHINE_ENTITY_TYPES.has(log.entity_type)) return null;
  const data = log.after_json || log.before_json;
  return (data?.machine_id as string) || null;
}

/**
 * Groups logs (already sorted ts DESC) into sessions.
 * A new session starts when actor, machine, or time gap changes.
 */
export function groupActivitiesIntoSessions(logs: AuditLog[]): ActivitySession[] {
  if (logs.length === 0) return [];

  const sessions: ActivitySession[] = [];
  let current: ActivitySession | null = null;

  for (const log of logs) {
    const machineId = getMachineId(log);
    const logTime = new Date(log.ts).getTime();

    if (current) {
      const currentStartTime = new Date(current.startTs).getTime();
      const sameActor = current.actorUserId === log.actor_user_id;
      const sameMachine = current.machineId === machineId && machineId !== null;
      // Since logs are DESC, new log.ts <= current.startTs
      const withinGap = (currentStartTime - logTime) <= SESSION_GAP_MS;

      if (sameActor && sameMachine && withinGap) {
        // Extend current session
        current.logs.push(log);
        current.startTs = log.ts; // log is older, so it becomes the start
        continue;
      }
    }

    // Start a new session
    current = {
      key: log.id,
      actorName: log.actor_name,
      actorUserId: log.actor_user_id,
      machineId,
      startTs: log.ts,
      endTs: log.ts,
      logs: [log],
    };
    sessions.push(current);
  }

  // For sessions with 1 entry that isn't machine-related, keep them flat
  return sessions;
}
