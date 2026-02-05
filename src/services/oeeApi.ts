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

export async function getPlants(companyId?: string): Promise<Plant[]> {
  let query = supabase
    .from('plants')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;
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

export async function getLines(plantId?: string, companyId?: string): Promise<Line[]> {
  let query = supabase
    .from('lines')
    .select('*, plant:plants(*)')
    .eq('is_active', true)
    .order('name');

  if (plantId) {
    query = query.eq('plant_id', plantId);
  }
  if (companyId) {
    query = query.eq('company_id', companyId);
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

export async function getMachines(lineId?: string, companyId?: string): Promise<Machine[]> {
  let query = supabase
    .from('machines')
    .select('*, line:lines(*, plant:plants(*))')
    .eq('is_active', true)
    .order('name');

  if (lineId) {
    query = query.eq('line_id', lineId);
  }
  if (companyId) {
    query = query.eq('company_id', companyId);
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
// DASHBOARD FUNCTIONS
// =============================================

export interface DashboardOEEData {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface MachineWithOEE {
  id: string;
  name: string;
  code: string;
  line_id: string;
  line_name?: string;
  status: 'running' | 'idle' | 'stopped' | 'maintenance';
  oee: number;
  currentProduct?: string;
}

export interface DashboardStats {
  running: number;
  idle: number;
  stopped: number;
  maintenance: number;
}

/**
 * Get aggregated OEE metrics for a company's machines
 */
export async function getDashboardOEE(companyId?: string): Promise<DashboardOEEData> {
  // Get all machines for the company
  const machines = await getMachines(undefined, companyId);
  
  if (machines.length === 0) {
    return { availability: 0, performance: 0, quality: 0, oee: 0 };
  }

  // Get latest OEE snapshot for each machine
  const machineIds = machines.map(m => m.id);
  
  const { data: snapshots, error } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', 'MACHINE')
    .in('scope_id', machineIds)
    .order('period_start', { ascending: false });

  if (error) throw error;

  // Get latest snapshot per machine
  const latestByMachine = new Map<string, OeeSnapshot>();
  for (const snap of snapshots || []) {
    if (!latestByMachine.has(snap.scope_id)) {
      latestByMachine.set(snap.scope_id, snap);
    }
  }

  const latestSnapshots = Array.from(latestByMachine.values());
  
  if (latestSnapshots.length === 0) {
    return { availability: 0, performance: 0, quality: 0, oee: 0 };
  }

  // Calculate averages
  const avgAvailability = latestSnapshots.reduce((sum, s) => sum + (Number(s.availability) || 0), 0) / latestSnapshots.length;
  const avgPerformance = latestSnapshots.reduce((sum, s) => sum + (Number(s.performance) || 0), 0) / latestSnapshots.length;
  const avgQuality = latestSnapshots.reduce((sum, s) => sum + (Number(s.quality) || 0), 0) / latestSnapshots.length;
  const avgOee = latestSnapshots.reduce((sum, s) => sum + (Number(s.oee) || 0), 0) / latestSnapshots.length;

  return {
    availability: Math.round(avgAvailability * 10) / 10,
    performance: Math.round(avgPerformance * 10) / 10,
    quality: Math.round(avgQuality * 10) / 10,
    oee: Math.round(avgOee * 10) / 10,
  };
}

/**
 * Get machines with their current status and OEE for dashboard display
 */
export async function getMachinesWithStatus(companyId?: string): Promise<{ machines: MachineWithOEE[]; stats: DashboardStats }> {
  // Get machines with line info
  const machines = await getMachines(undefined, companyId);
  
  if (machines.length === 0) {
    return { 
      machines: [], 
      stats: { running: 0, idle: 0, stopped: 0, maintenance: 0 } 
    };
  }

  const machineIds = machines.map(m => m.id);

  // Get latest OEE snapshots for all machines
  const { data: snapshots, error: snapshotError } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', 'MACHINE')
    .in('scope_id', machineIds)
    .order('period_start', { ascending: false });

  if (snapshotError) throw snapshotError;

  // Get current production events (open events)
  const { data: events, error: eventError } = await supabase
    .from('production_events')
    .select('*')
    .in('machine_id', machineIds)
    .is('end_ts', null);

  if (eventError) throw eventError;

  // Create lookup maps
  const latestOeeByMachine = new Map<string, number>();
  for (const snap of snapshots || []) {
    if (!latestOeeByMachine.has(snap.scope_id)) {
      latestOeeByMachine.set(snap.scope_id, Number(snap.oee) || 0);
    }
  }

  const eventByMachine = new Map<string, { event_type: string }>();
  for (const event of events || []) {
    eventByMachine.set(event.machine_id, event);
  }

  // Build machine list with status
  const stats: DashboardStats = { running: 0, idle: 0, stopped: 0, maintenance: 0 };
  
  const machinesWithStatus: MachineWithOEE[] = machines.map(machine => {
    const currentEvent = eventByMachine.get(machine.id);
    const oee = latestOeeByMachine.get(machine.id) || 0;
    
    let status: 'running' | 'idle' | 'stopped' | 'maintenance';
    
    if (currentEvent) {
      switch (currentEvent.event_type) {
        case 'RUN':
          status = 'running';
          stats.running++;
          break;
        case 'DOWNTIME':
          status = 'stopped';
          stats.stopped++;
          break;
        case 'SETUP':
          status = 'maintenance';
          stats.maintenance++;
          break;
        default:
          status = 'idle';
          stats.idle++;
      }
    } else {
      status = 'idle';
      stats.idle++;
    }

    return {
      id: machine.id,
      name: machine.name,
      code: machine.code,
      line_id: machine.line_id,
      line_name: machine.line?.name,
      status,
      oee: Math.round(oee * 10) / 10,
      currentProduct: undefined, // Would need product tracking to implement
    };
  });

  return { machines: machinesWithStatus, stats };
}

/**
 * Get OEE trend data for the last 7 days
 */
export async function getOEETrend(companyId?: string): Promise<{ date: string; availability: number; performance: number; quality: number; oee: number }[]> {
  const machines = await getMachines(undefined, companyId);
  
  if (machines.length === 0) {
    return [];
  }

  const machineIds = machines.map(m => m.id);
  
  // Get snapshots for last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  const { data: snapshots, error } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', 'MACHINE')
    .eq('period', 'SHIFT')
    .in('scope_id', machineIds)
    .gte('period_start', startDate.toISOString())
    .lte('period_start', endDate.toISOString())
    .order('period_start');

  if (error) throw error;

  // Group by date and calculate averages
  const byDate = new Map<string, { availability: number[]; performance: number[]; quality: number[]; oee: number[] }>();
  
  for (const snap of snapshots || []) {
    const date = new Date(snap.period_start).toLocaleDateString('en-US', { weekday: 'short' });
    if (!byDate.has(date)) {
      byDate.set(date, { availability: [], performance: [], quality: [], oee: [] });
    }
    const entry = byDate.get(date)!;
    entry.availability.push(Number(snap.availability) || 0);
    entry.performance.push(Number(snap.performance) || 0);
    entry.quality.push(Number(snap.quality) || 0);
    entry.oee.push(Number(snap.oee) || 0);
  }

  // Calculate averages per day
  const result: { date: string; availability: number; performance: number; quality: number; oee: number }[] = [];
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dayName = days[d.getDay()];
    
    const entry = byDate.get(dayName);
    if (entry && entry.oee.length > 0) {
      result.push({
        date: dayName,
        availability: Math.round(entry.availability.reduce((a, b) => a + b, 0) / entry.availability.length),
        performance: Math.round(entry.performance.reduce((a, b) => a + b, 0) / entry.performance.length),
        quality: Math.round(entry.quality.reduce((a, b) => a + b, 0) / entry.quality.length),
        oee: Math.round(entry.oee.reduce((a, b) => a + b, 0) / entry.oee.length),
      });
    } else {
      result.push({ date: dayName, availability: 0, performance: 0, quality: 0, oee: 0 });
    }
  }

  return result;
}

// =============================================
// MACHINE DETAIL FUNCTIONS
// =============================================

export interface MachineOEEHistory {
  machine: Machine | null;
  snapshots: OeeSnapshot[];
}

/**
 * Get OEE history for a specific machine
 */
export async function getMachineOEEHistory(machineId: string, days: number = 7): Promise<MachineOEEHistory> {
  // Get machine info
  const machine = await getMachineById(machineId);

  // Get snapshots for specified days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: snapshots, error } = await supabase
    .from('oee_snapshots')
    .select('*')
    .eq('scope', 'MACHINE')
    .eq('scope_id', machineId)
    .gte('period_start', startDate.toISOString())
    .order('period_start', { ascending: false });

  if (error) throw error;

  return {
    machine,
    snapshots: snapshots || [],
  };
}

export interface DowntimeBreakdown {
  reason_id: string;
  reason_name: string;
  reason_code: string;
  category: string;
  total_minutes: number;
  event_count: number;
}

/**
 * Get downtime breakdown by reason for a machine within a time period
 */
export async function getMachineDowntimeBreakdown(
  machineId: string,
  days: number = 7
): Promise<DowntimeBreakdown[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get all downtime/setup events for this machine
  const { data: events, error } = await supabase
    .from('production_events')
    .select(`
      id,
      event_type,
      start_ts,
      end_ts,
      reason_id,
      reason:downtime_reasons(id, name, code, category)
    `)
    .eq('machine_id', machineId)
    .in('event_type', ['DOWNTIME', 'SETUP'])
    .gte('start_ts', startDate.toISOString())
    .not('reason_id', 'is', null);

  if (error) throw error;
  if (!events || events.length === 0) return [];

  // Aggregate by reason
  const breakdownMap = new Map<string, DowntimeBreakdown>();
  
  for (const event of events) {
    if (!event.reason_id || !event.reason) continue;
    
    const endTs = event.end_ts ? new Date(event.end_ts) : new Date();
    const startTs = new Date(event.start_ts);
    const durationMinutes = Math.round((endTs.getTime() - startTs.getTime()) / (1000 * 60));
    
    const reason = event.reason as unknown as { id: string; name: string; code: string; category: string };
    
    if (breakdownMap.has(event.reason_id)) {
      const existing = breakdownMap.get(event.reason_id)!;
      existing.total_minutes += durationMinutes;
      existing.event_count += 1;
    } else {
      breakdownMap.set(event.reason_id, {
        reason_id: event.reason_id,
        reason_name: reason.name,
        reason_code: reason.code,
        category: reason.category,
        total_minutes: durationMinutes,
        event_count: 1,
      });
    }
  }

  // Sort by total duration descending
  return Array.from(breakdownMap.values()).sort((a, b) => b.total_minutes - a.total_minutes);
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
  endDate?: string,
  companyId?: string
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

  // Filter by company through plant relationship if companyId is provided
  // Note: v_shift_summary would need to include company_id for direct filtering
  // For now, we'll filter by fetching plants first if needed

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

  // Dashboard
  getDashboardOEE,
  getMachinesWithStatus,
  getOEETrend,

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
