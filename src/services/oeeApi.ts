import { supabase } from '@/integrations/supabase/client';
import type {
  EventType,
  DowntimeCategory,
  Plant,
  Line,
  Machine,
  Shift,
  ShiftCalendar,
  DowntimeReason,
  DefectReason,
  ProductionEvent,
  ProductionCount,
  OeeSnapshot,
  UserProfile,
  CurrentShiftByMachine,
  ShiftSummary,
  StartEventResponse,
  StopEventResponse,
  AddCountsResponse,
  ApproveShiftResponse,
  LockShiftResponse,
  RecalcOeeResponse,
  OeeApiError,
} from './types';

// =============================================
// HELPER FUNCTIONS
// =============================================

function handleRpcError(response: { success: boolean; error?: string; message?: string }) {
  if (!response.success) {
    const error = new Error(response.message || 'Unknown error') as OeeApiError;
    error.name = 'OeeApiError';
    (error as any).code = response.error || 'VALIDATION_ERROR';
    throw error;
  }
  return response;
}

// =============================================
// RPC FUNCTIONS - Production Events
// =============================================

export async function startEvent(
  machineId: string,
  eventType: EventType,
  reasonId?: string,
  notes?: string
): Promise<StartEventResponse> {
  const { data, error } = await supabase.rpc('rpc_start_event', {
    p_machine_id: machineId,
    p_event_type: eventType,
    p_reason_id: reasonId || null,
    p_notes: notes || null,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as StartEventResponse) as StartEventResponse;
}

export async function stopEvent(
  machineId: string,
  notes?: string
): Promise<StopEventResponse> {
  const { data, error } = await supabase.rpc('rpc_stop_event', {
    p_machine_id: machineId,
    p_notes: notes || null,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as StopEventResponse) as StopEventResponse;
}

// =============================================
// RPC FUNCTIONS - Production Counts
// =============================================

export async function addCounts(
  machineId: string,
  goodQty: number,
  rejectQty: number = 0,
  defectReasonId?: string,
  notes?: string
): Promise<AddCountsResponse> {
  const { data, error } = await supabase.rpc('rpc_add_counts', {
    p_machine_id: machineId,
    p_good_qty: goodQty,
    p_reject_qty: rejectQty,
    p_defect_reason_id: defectReasonId || null,
    p_notes: notes || null,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as AddCountsResponse) as AddCountsResponse;
}

// =============================================
// RPC FUNCTIONS - Shift Management
// =============================================

export async function approveShift(
  shiftCalendarId: string
): Promise<ApproveShiftResponse> {
  const { data, error } = await supabase.rpc('rpc_approve_shift', {
    p_shift_calendar_id: shiftCalendarId,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as ApproveShiftResponse) as ApproveShiftResponse;
}

export async function lockShift(
  shiftCalendarId: string
): Promise<LockShiftResponse> {
  const { data, error } = await supabase.rpc('rpc_lock_shift', {
    p_shift_calendar_id: shiftCalendarId,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as LockShiftResponse) as LockShiftResponse;
}

export async function recalcOeeForShift(
  shiftCalendarId: string
): Promise<RecalcOeeResponse> {
  const { data, error } = await supabase.rpc('rpc_recalc_oee_for_shift', {
    p_shift_calendar_id: shiftCalendarId,
  });

  if (error) throw error;
  return handleRpcError(data as unknown as RecalcOeeResponse) as RecalcOeeResponse;
}

// =============================================
// QUERY FUNCTIONS - Plants
// =============================================

export async function getPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getPlantById(id: string): Promise<Plant | null> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// =============================================
// QUERY FUNCTIONS - Lines
// =============================================

export async function getLines(plantId?: string): Promise<Line[]> {
  let query = supabase
    .from('lines')
    .select('*, plant:plants(*)')
    .eq('is_active', true)
    .order('name');

  if (plantId) {
    query = query.eq('plant_id', plantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLineById(id: string): Promise<Line | null> {
  const { data, error } = await supabase
    .from('lines')
    .select('*, plant:plants(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// =============================================
// QUERY FUNCTIONS - Machines
// =============================================

export async function getMachines(lineId?: string): Promise<Machine[]> {
  let query = supabase
    .from('machines')
    .select('*, line:lines(*, plant:plants(*))')
    .eq('is_active', true)
    .order('name');

  if (lineId) {
    query = query.eq('line_id', lineId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getMachineById(id: string): Promise<Machine | null> {
  const { data, error } = await supabase
    .from('machines')
    .select('*, line:lines(*, plant:plants(*))')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getMachinesByPlant(plantId: string): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('*, line:lines!inner(*, plant:plants(*))')
    .eq('line.plant_id', plantId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// =============================================
// QUERY FUNCTIONS - Shifts
// =============================================

export async function getShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('is_active', true)
    .order('start_time');

  if (error) throw error;
  return data || [];
}

export async function getShiftCalendar(
  plantId: string,
  startDate: string,
  endDate: string
): Promise<ShiftCalendar[]> {
  const { data, error } = await supabase
    .from('shift_calendar')
    .select('*, shift:shifts(*), plant:plants(*)')
    .eq('plant_id', plantId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date')
    .order('shift_id');

  if (error) throw error;
  return data || [];
}

export async function getTodayShiftCalendar(plantId: string): Promise<ShiftCalendar[]> {
  const today = new Date().toISOString().split('T')[0];
  return getShiftCalendar(plantId, today, today);
}

// =============================================
// QUERY FUNCTIONS - Reasons
// =============================================

export async function getDowntimeReasons(category?: DowntimeCategory): Promise<DowntimeReason[]> {
  let query = supabase
    .from('downtime_reasons')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DowntimeReason[];
}

export async function getDefectReasons(): Promise<DefectReason[]> {
  const { data, error } = await supabase
    .from('defect_reasons')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// =============================================
// QUERY FUNCTIONS - Production Events
// =============================================

export async function getProductionEvents(
  machineId: string,
  shiftCalendarId?: string
): Promise<ProductionEvent[]> {
  let query = supabase
    .from('production_events')
    .select('*, machine:machines(*), reason:downtime_reasons(*)')
    .eq('machine_id', machineId)
    .order('start_ts', { ascending: false });

  if (shiftCalendarId) {
    query = query.eq('shift_calendar_id', shiftCalendarId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCurrentEvent(machineId: string): Promise<ProductionEvent | null> {
  const { data, error } = await supabase
    .from('production_events')
    .select('*, machine:machines(*), reason:downtime_reasons(*)')
    .eq('machine_id', machineId)
    .is('end_ts', null)
    .order('start_ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// =============================================
// QUERY FUNCTIONS - Production Counts
// =============================================

export async function getProductionCounts(
  machineId: string,
  shiftCalendarId?: string
): Promise<ProductionCount[]> {
  let query = supabase
    .from('production_counts')
    .select('*, machine:machines(*), defect_reason:defect_reasons(*)')
    .eq('machine_id', machineId)
    .order('ts', { ascending: false });

  if (shiftCalendarId) {
    query = query.eq('shift_calendar_id', shiftCalendarId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// =============================================
// QUERY FUNCTIONS - OEE Snapshots
// =============================================

export async function getOeeSnapshots(
  scope: 'MACHINE' | 'LINE' | 'PLANT',
  scopeId: string,
  period: 'SHIFT' | 'DAY',
  startDate: string,
  endDate: string
): Promise<OeeSnapshot[]> {
  const { data, error } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .eq('period', period)
    .gte('period_start', startDate)
    .lte('period_start', endDate)
    .order('period_start');

  if (error) throw error;
  return data || [];
}

export async function getLatestOeeByMachine(machineId: string): Promise<OeeSnapshot | null> {
  const { data, error } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', 'MACHINE')
    .eq('scope_id', machineId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// =============================================
// QUERY FUNCTIONS - Views
// =============================================

export async function getCurrentShiftByMachine(): Promise<CurrentShiftByMachine[]> {
  const { data, error } = await supabase
    .from('v_current_shift_by_machine')
    .select('*')
    .order('machine_name');

  if (error) throw error;
  return data || [];
}

export async function getShiftSummaries(
  plantId?: string,
  startDate?: string,
  endDate?: string
): Promise<ShiftSummary[]> {
  let query = supabase
    .from('v_shift_summary')
    .select('*')
    .order('shift_date', { ascending: false });

  if (plantId) {
    query = query.eq('plant_id', plantId);
  }
  if (startDate) {
    query = query.gte('shift_date', startDate);
  }
  if (endDate) {
    query = query.lte('shift_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// =============================================
// QUERY FUNCTIONS - User Profile
// =============================================

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function getUserPermissions(userId: string) {
  const [machines, lines, plants] = await Promise.all([
    supabase
      .from('user_machine_permissions')
      .select('machine_id, machine:machines(*)')
      .eq('user_id', userId),
    supabase
      .from('user_line_permissions')
      .select('line_id, line:lines(*)')
      .eq('user_id', userId),
    supabase
      .from('user_plant_permissions')
      .select('plant_id, plant:plants(*)')
      .eq('user_id', userId),
  ]);

  return {
    machines: machines.data || [],
    lines: lines.data || [],
    plants: plants.data || [],
  };
}

// =============================================
// AUTH FUNCTIONS
// =============================================

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

// =============================================
// EXPORT DEFAULT API OBJECT
// =============================================

const oeeApi = {
  // RPC Functions
  startEvent,
  stopEvent,
  addCounts,
  approveShift,
  lockShift,
  recalcOeeForShift,

  // Plants
  getPlants,
  getPlantById,

  // Lines
  getLines,
  getLineById,

  // Machines
  getMachines,
  getMachineById,
  getMachinesByPlant,

  // Shifts
  getShifts,
  getShiftCalendar,
  getTodayShiftCalendar,

  // Reasons
  getDowntimeReasons,
  getDefectReasons,

  // Production Events
  getProductionEvents,
  getCurrentEvent,

  // Production Counts
  getProductionCounts,

  // OEE Snapshots
  getOeeSnapshots,
  getLatestOeeByMachine,

  // Views
  getCurrentShiftByMachine,
  getShiftSummaries,

  // User
  getCurrentUserProfile,
  getUserPermissions,

  // Auth
  signIn,
  signUp,
  signOut,
  getSession,
  onAuthStateChange,
};

export default oeeApi;
