// =============================================
// API RESPONSE TYPES
// =============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export interface RpcResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface StartEventResponse extends RpcResponse {
  event_id?: string;
}

export interface StopEventResponse extends RpcResponse {
  event_id?: string;
  duration_minutes?: number;
}

export interface AddCountsResponse extends RpcResponse {
  count_id?: string;
  total_qty?: number;
}

export interface ApproveShiftResponse extends RpcResponse {
  shift_calendar_id?: string;
  status?: 'APPROVED';
}

export interface LockShiftResponse extends RpcResponse {
  shift_calendar_id?: string;
  status?: 'LOCKED';
}

export interface RecalcOeeResponse extends RpcResponse {
  shift_calendar_id?: string;
  machines_processed?: number;
}

// =============================================
// ENUM TYPES
// =============================================

export type AppRole = 'STAFF' | 'SUPERVISOR' | 'EXECUTIVE' | 'ADMIN';
export type EventType = 'RUN' | 'DOWNTIME' | 'SETUP';
export type ApprovalStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';
export type OeeScope = 'MACHINE' | 'LINE' | 'PLANT';
export type OeePeriod = 'SHIFT' | 'DAY';
export type DowntimeCategory = 'PLANNED' | 'UNPLANNED' | 'BREAKDOWN' | 'CHANGEOVER';
export type MachineStatus = 'running' | 'idle' | 'stopped' | 'maintenance';

// =============================================
// ENTITY TYPES
// =============================================

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
  line?: Line;
}

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
  shift?: Shift;
  plant?: Plant;
}

export interface DowntimeReason {
  id: string;
  code: string;
  name: string;
  category: DowntimeCategory;
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
  machine?: Machine;
  reason?: DowntimeReason;
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
  machine?: Machine;
  defect_reason?: DefectReason;
}

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
}

export interface OeeSnapshot {
  id: string;
  scope: OeeScope;
  scope_id: string;
  period: OeePeriod;
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

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

// =============================================
// VIEW TYPES
// =============================================

export interface CurrentShiftByMachine {
  machine_id: string;
  machine_name: string;
  machine_code: string;
  line_id: string;
  line_name: string;
  plant_id: string;
  plant_name: string;
  shift_calendar_id: string;
  shift_date: string;
  shift_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  planned_time_minutes: number;
  approval_status: ApprovalStatus;
}

export interface ShiftSummary {
  shift_calendar_id: string;
  shift_date: string;
  shift_name: string;
  plant_id: string;
  plant_name: string;
  planned_time_minutes: number;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  locked_by?: string;
  locked_at?: string;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  avg_oee: number;
  total_run_time: number;
  total_downtime: number;
  total_good_qty: number;
  total_reject_qty: number;
  machine_count: number;
}

// =============================================
// DASHBOARD TYPES
// =============================================

export interface OeeSummary {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface MachineWithStatus extends Machine {
  status: MachineStatus;
  current_oee: number;
  current_event?: ProductionEvent;
}

export interface DashboardData {
  summary: OeeSummary;
  machines: MachineWithStatus[];
  trends: OeeSnapshot[];
  statusCounts: {
    running: number;
    idle: number;
    stopped: number;
    maintenance: number;
  };
}

// =============================================
// ERROR TYPES
// =============================================

export type ErrorCode = 
  | 'PERMISSION_DENIED'
  | 'SHIFT_LOCKED'
  | 'OVERLAP_EVENT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR';

export class OeeApiError extends Error {
  code: ErrorCode;
  
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'OeeApiError';
  }
}
