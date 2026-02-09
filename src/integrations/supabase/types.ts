export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          entity_id: string
          entity_type: string
          id: string
          ts: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ts?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ts?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      defect_reasons: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_reasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      downtime_reasons: {
        Row: {
          category: Database["public"]["Enums"]["downtime_category"]
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["downtime_category"]
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["downtime_category"]
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "downtime_reasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          plant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      machine_permission_group_machines: {
        Row: {
          created_at: string
          group_id: string
          id: string
          machine_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          machine_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          machine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_permission_group_machines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "machine_permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_permission_group_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_permission_group_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["machine_id"]
          },
        ]
      }
      machine_permission_groups: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_permission_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          ideal_cycle_time_seconds: number
          is_active: boolean
          line_id: string
          name: string
          target_availability: number | null
          target_oee: number | null
          target_performance: number | null
          target_quality: number | null
          time_unit: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          line_id: string
          name: string
          target_availability?: number | null
          target_oee?: number | null
          target_performance?: number | null
          target_quality?: number | null
          time_unit?: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          line_id?: string
          name?: string
          target_availability?: number | null
          target_oee?: number | null
          target_performance?: number | null
          target_quality?: number | null
          time_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["line_id"]
          },
        ]
      }
      oee_snapshots: {
        Row: {
          availability: number | null
          created_at: string
          downtime_minutes: number | null
          good_qty: number | null
          id: string
          oee: number | null
          performance: number | null
          period: Database["public"]["Enums"]["oee_period"]
          period_end: string
          period_start: string
          planned_time_minutes: number | null
          quality: number | null
          reject_qty: number | null
          run_time_minutes: number | null
          scope: Database["public"]["Enums"]["oee_scope"]
          scope_id: string
          shift_calendar_id: string | null
        }
        Insert: {
          availability?: number | null
          created_at?: string
          downtime_minutes?: number | null
          good_qty?: number | null
          id?: string
          oee?: number | null
          performance?: number | null
          period: Database["public"]["Enums"]["oee_period"]
          period_end: string
          period_start: string
          planned_time_minutes?: number | null
          quality?: number | null
          reject_qty?: number | null
          run_time_minutes?: number | null
          scope: Database["public"]["Enums"]["oee_scope"]
          scope_id: string
          shift_calendar_id?: string | null
        }
        Update: {
          availability?: number | null
          created_at?: string
          downtime_minutes?: number | null
          good_qty?: number | null
          id?: string
          oee?: number | null
          performance?: number | null
          period?: Database["public"]["Enums"]["oee_period"]
          period_end?: string
          period_start?: string
          planned_time_minutes?: number | null
          quality?: number | null
          reject_qty?: number | null
          run_time_minutes?: number | null
          scope?: Database["public"]["Enums"]["oee_scope"]
          scope_id?: string
          shift_calendar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oee_snapshots_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "shift_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oee_snapshots_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_calendar_id"]
          },
          {
            foreignKeyName: "oee_snapshots_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["shift_calendar_id"]
          },
        ]
      }
      planned_time_templates: {
        Row: {
          break_minutes: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          maintenance_minutes: number
          meal_minutes: number
          meeting_minutes: number
          other_label: string | null
          other_minutes: number
          plant_id: string
          shift_id: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          maintenance_minutes?: number
          meal_minutes?: number
          meeting_minutes?: number
          other_label?: string | null
          other_minutes?: number
          plant_id: string
          shift_id: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          maintenance_minutes?: number
          meal_minutes?: number
          meeting_minutes?: number
          other_label?: string | null
          other_minutes?: number
          plant_id?: string
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_time_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_time_templates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_time_templates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "planned_time_templates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "planned_time_templates_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_time_templates_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_id"]
          },
        ]
      }
      plants: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_counts: {
        Row: {
          created_at: string
          created_by: string
          defect_reason_id: string | null
          good_qty: number
          id: string
          machine_id: string
          notes: string | null
          reject_qty: number
          shift_calendar_id: string
          ts: string
        }
        Insert: {
          created_at?: string
          created_by: string
          defect_reason_id?: string | null
          good_qty?: number
          id?: string
          machine_id: string
          notes?: string | null
          reject_qty?: number
          shift_calendar_id: string
          ts?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          defect_reason_id?: string | null
          good_qty?: number
          id?: string
          machine_id?: string
          notes?: string | null
          reject_qty?: number
          shift_calendar_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_counts_defect_reason_id_fkey"
            columns: ["defect_reason_id"]
            isOneToOne: false
            referencedRelation: "defect_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "production_counts_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "shift_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_counts_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_calendar_id"]
          },
          {
            foreignKeyName: "production_counts_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["shift_calendar_id"]
          },
        ]
      }
      production_events: {
        Row: {
          created_at: string
          created_by: string
          end_ts: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          line_id: string
          machine_id: string
          notes: string | null
          plant_id: string
          product_id: string | null
          reason_id: string | null
          shift_calendar_id: string
          start_ts: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_ts?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          line_id: string
          machine_id: string
          notes?: string | null
          plant_id: string
          product_id?: string | null
          reason_id?: string | null
          shift_calendar_id: string
          start_ts?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_ts?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          line_id?: string
          machine_id?: string
          notes?: string | null
          plant_id?: string
          product_id?: string | null
          reason_id?: string | null
          shift_calendar_id?: string
          start_ts?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "production_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "production_events_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_events_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "production_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "downtime_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "shift_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_events_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_calendar_id"]
          },
          {
            foreignKeyName: "production_events_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["shift_calendar_id"]
          },
        ]
      }
      production_standards: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ideal_cycle_time_seconds: number
          is_active: boolean
          machine_id: string
          product_id: string
          std_setup_time_seconds: number
          target_quality: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          machine_id: string
          product_id: string
          std_setup_time_seconds?: number
          target_quality?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          machine_id?: string
          product_id?: string
          std_setup_time_seconds?: number
          target_quality?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          shift_calendar_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          shift_calendar_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          shift_calendar_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_approvals_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: true
            referencedRelation: "shift_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_approvals_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: true
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_calendar_id"]
          },
          {
            foreignKeyName: "shift_approvals_shift_calendar_id_fkey"
            columns: ["shift_calendar_id"]
            isOneToOne: true
            referencedRelation: "v_shift_summary"
            referencedColumns: ["shift_calendar_id"]
          },
        ]
      }
      shift_calendar: {
        Row: {
          created_at: string
          id: string
          planned_time_minutes: number
          plant_id: string
          shift_date: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          planned_time_minutes?: number
          plant_id: string
          shift_date: string
          shift_id: string
        }
        Update: {
          created_at?: string
          id?: string
          planned_time_minutes?: number
          plant_id?: string
          shift_date?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_calendar_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_calendar_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "shift_calendar_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "shift_calendar_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_calendar_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["shift_id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      user_line_permissions: {
        Row: {
          created_at: string
          id: string
          line_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_line_permissions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_line_permissions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["line_id"]
          },
        ]
      }
      user_machine_permissions: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_machine_permissions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_machine_permissions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["machine_id"]
          },
        ]
      }
      user_permission_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "machine_permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plant_permissions: {
        Row: {
          created_at: string
          id: string
          plant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plant_permissions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plant_permissions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_current_shift_by_machine"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_plant_permissions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "v_shift_summary"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_audit_logs_readable: {
        Row: {
          action: string | null
          actor_name: string | null
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          ts: string | null
        }
        Relationships: []
      }
      v_current_shift_by_machine: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          end_time: string | null
          line_id: string | null
          line_name: string | null
          machine_code: string | null
          machine_id: string | null
          machine_name: string | null
          planned_time_minutes: number | null
          plant_id: string | null
          plant_name: string | null
          shift_calendar_id: string | null
          shift_date: string | null
          shift_id: string | null
          shift_name: string | null
          start_time: string | null
        }
        Relationships: []
      }
      v_shift_summary: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          avg_availability: number | null
          avg_oee: number | null
          avg_performance: number | null
          avg_quality: number | null
          locked_at: string | null
          locked_by: string | null
          machine_count: number | null
          planned_time_minutes: number | null
          plant_id: string | null
          plant_name: string | null
          shift_calendar_id: string | null
          shift_date: string | null
          shift_name: string | null
          total_downtime: number | null
          total_good_qty: number | null
          total_reject_qty: number | null
          total_run_time: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_line_from_machine: { Args: { _machine_id: string }; Returns: string }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      get_user_permitted_machine_ids: { Args: never; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_line_permission: {
        Args: { _line_id: string; _user_id: string }
        Returns: boolean
      }
      has_machine_permission: {
        Args: { _machine_id: string; _user_id: string }
        Returns: boolean
      }
      has_plant_permission: {
        Args: { _plant_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      is_shift_locked: {
        Args: { _shift_calendar_id: string }
        Returns: boolean
      }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor_of_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      rpc_add_counts: {
        Args: {
          p_defect_reason_id?: string
          p_good_qty: number
          p_machine_id: string
          p_notes?: string
          p_reject_qty?: number
        }
        Returns: Json
      }
      rpc_approve_shift: {
        Args: { p_shift_calendar_id: string }
        Returns: Json
      }
      rpc_create_manual_event: {
        Args: {
          p_end_ts?: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_machine_id: string
          p_notes?: string
          p_product_id?: string
          p_reason_id?: string
          p_start_ts: string
        }
        Returns: Json
      }
      rpc_lock_shift: { Args: { p_shift_calendar_id: string }; Returns: Json }
      rpc_recalc_oee_for_shift: {
        Args: { p_shift_calendar_id: string }
        Returns: Json
      }
      rpc_start_event:
        | {
            Args: {
              p_event_type: Database["public"]["Enums"]["event_type"]
              p_machine_id: string
              p_notes?: string
              p_reason_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_event_type: Database["public"]["Enums"]["event_type"]
              p_machine_id: string
              p_notes?: string
              p_product_id?: string
              p_reason_id?: string
            }
            Returns: Json
          }
      rpc_stop_event: {
        Args: { p_machine_id: string; p_notes?: string }
        Returns: Json
      }
      rpc_update_event: {
        Args: {
          p_end_ts?: string
          p_event_id: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_notes?: string
          p_start_ts: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "STAFF" | "SUPERVISOR" | "EXECUTIVE" | "ADMIN"
      approval_status: "DRAFT" | "APPROVED" | "LOCKED"
      downtime_category: "PLANNED" | "UNPLANNED" | "BREAKDOWN" | "CHANGEOVER"
      event_type: "RUN" | "DOWNTIME" | "SETUP"
      oee_period: "SHIFT" | "DAY"
      oee_scope: "MACHINE" | "LINE" | "PLANT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["STAFF", "SUPERVISOR", "EXECUTIVE", "ADMIN"],
      approval_status: ["DRAFT", "APPROVED", "LOCKED"],
      downtime_category: ["PLANNED", "UNPLANNED", "BREAKDOWN", "CHANGEOVER"],
      event_type: ["RUN", "DOWNTIME", "SETUP"],
      oee_period: ["SHIFT", "DAY"],
      oee_scope: ["MACHINE", "LINE", "PLANT"],
    },
  },
} as const
