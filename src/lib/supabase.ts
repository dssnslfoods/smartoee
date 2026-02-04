import { createClient } from '@supabase/supabase-js';

// External Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// TYPE DEFINITIONS
// =============================================

// Enums
export type AppRole = 'admin' | 'executive' | 'supervisor' | 'staff';
export type EventType = 'RUN' | 'DOWNTIME' | 'SETUP';
export type ApprovalStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';
export type OEEScope = 'MACHINE' | 'LINE' | 'PLANT';
export type OEEPeriod = 'SHIFT' | 'DAY';
export type MachineStatus = 'running' | 'idle' | 'stopped' | 'maintenance';

// User Management
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Plant Hierarchy
export interface Plant {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Line {
  id: string;
  plant_id: string;
  name: string;
  code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  plant?: Plant;
}

export interface Machine {
  id: string;
  line_id: string;
  name: string;
  code: string;
  ideal_cycle_time_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  line?: Line;
  // Computed
  status?: MachineStatus;
  current_oee?: number;
}

// Shift Management
export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface ShiftCalendar {
  id: string;
  shift_id: string;
  shift_date: string;
  plant_id: string;
  planned_time_minutes: number;
  created_at: string;
  // Joined
  shift?: Shift;
  plant?: Plant;
}

// Master Data
export interface DowntimeReason {
  id: string;
  code: string;
  name: string;
  category: 'PLANNED' | 'UNPLANNED' | 'BREAKDOWN' | 'CHANGEOVER';
  is_active: boolean;
  created_at: string;
}

export interface DefectReason {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

// Transactions
export interface ProductionEvent {
  id: string;
  plant_id: string;
  line_id: string;
  machine_id: string;
  shift_calendar_id: string;
  event_type: EventType;
  reason_id?: string;
  start_ts: string;
  end_ts?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  machine?: Machine;
  reason?: DowntimeReason;
  shift_calendar?: ShiftCalendar;
}

export interface ProductionCount {
  id: string;
  shift_calendar_id: string;
  machine_id: string;
  ts: string;
  good_qty: number;
  reject_qty: number;
  defect_reason_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  // Joined
  machine?: Machine;
  defect_reason?: DefectReason;
}

// Control
export interface ShiftApproval {
  id: string;
  shift_calendar_id: string;
  status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  locked_by?: string;
  locked_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  shift_calendar?: ShiftCalendar;
}

// Output
export interface OEESnapshot {
  id: string;
  scope: OEEScope;
  scope_id: string;
  period: OEEPeriod;
  period_start: string;
  period_end: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  run_time_minutes: number;
  downtime_minutes: number;
  planned_time_minutes: number;
  good_qty: number;
  reject_qty: number;
  created_at: string;
}

// Audit
export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
  actor_user_id?: string;
  ts: string;
}

// =============================================
// DASHBOARD COMPUTED TYPES
// =============================================

export interface OEESummary {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface MachineWithStatus extends Machine {
  status: MachineStatus;
  current_oee: number;
  current_product?: string;
}

export interface DashboardData {
  summary: OEESummary;
  machines: MachineWithStatus[];
  trends: OEESnapshot[];
  statusCounts: {
    running: number;
    idle: number;
    stopped: number;
    maintenance: number;
  };
}
