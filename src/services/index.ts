// =============================================
// SERVICE LAYER EXPORTS
// =============================================

// Supabase Client - use single source from integrations
export { supabase } from '@/integrations/supabase/client';

// OEE API (default export)
export { default as oeeApi } from './oeeApi';

// Individual API Functions
export {
  // RPC Functions
  startEvent,
  stopEvent,
  addCounts,
  approveShift,
  lockShift,
  recalcOeeForShift,

  // Query Functions - Plants
  getPlants,
  getPlantById,

  // Query Functions - Lines
  getLines,
  getLineById,

  // Query Functions - Machines
  getMachines,
  getMachineById,
  getMachinesByPlant,

  // Query Functions - Shifts
  getShifts,
  getShiftCalendar,
  getTodayShiftCalendar,

  // Query Functions - Reasons
  getDowntimeReasons,
  getDefectReasons,

  // Query Functions - Products
  getProducts,

  // Query Functions - Production Events
  getProductionEvents,
  getCurrentEvent,

  // Query Functions - Production Counts
  getProductionCounts,

  // Query Functions - OEE Snapshots
  getOeeSnapshots,
  getLatestOeeByMachine,

  // Query Functions - Views
  getCurrentShiftByMachine,
  getShiftSummaries,

  // Query Functions - User
  getCurrentUserProfile,
  getUserPermissions,

  // Auth Functions
  signIn,
  signUp,
  signOut,
  getSession,
  onAuthStateChange,
} from './oeeApi';

// Types
export type {
  // API Response Types
  ApiResponse,
  RpcResponse,
  StartEventResponse,
  StopEventResponse,
  AddCountsResponse,
  ApproveShiftResponse,
  LockShiftResponse,
  RecalcOeeResponse,

  // Enum Types
  AppRole,
  EventType,
  ApprovalStatus,
  OeeScope,
  OeePeriod,
  DowntimeCategory,
  MachineStatus,

  // Entity Types
  Plant,
  Line,
  Machine,
  Shift,
  ShiftCalendar,
  DowntimeReason,
  DefectReason,
  Product,
  ProductionEvent,
  ProductionCount,
  ShiftApproval,
  OeeSnapshot,
  UserProfile,

  // View Types
  CurrentShiftByMachine,
  ShiftSummary,

  // Dashboard Types
  OeeSummary,
  MachineWithStatus,
  DashboardData,

  // Error Types
  ErrorCode,
} from './types';

export { OeeApiError } from './types';
