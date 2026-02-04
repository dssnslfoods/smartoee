import { createClient } from '@supabase/supabase-js';

// External Supabase configuration
// These must be set via environment variables or secrets
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for database
export type UserRole = 'admin' | 'executive' | 'supervisor' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  line_id: string;
  status: 'running' | 'idle' | 'stopped' | 'maintenance';
  created_at: string;
}

export interface ProductionLine {
  id: string;
  code: string;
  name: string;
  plant_id: string;
  created_at: string;
}

export interface OEERecord {
  id: string;
  machine_id: string;
  production_date: string;
  shift: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  planned_time: number;
  operating_time: number;
  ideal_cycle_time: number;
  total_pieces: number;
  good_pieces: number;
  created_at: string;
}
