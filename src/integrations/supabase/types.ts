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
      defect_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      downtime_reasons: {
        Row: {
          category: Database["public"]["Enums"]["downtime_category"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["downtime_category"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["downtime_category"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      lines: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          plant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          code: string
          created_at: string
          id: string
          ideal_cycle_time_seconds: number
          is_active: boolean
          line_id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          line_id: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          ideal_cycle_time_seconds?: number
          is_active?: boolean
          line_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
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
        }
        Relationships: []
      }
      plants: {
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
            foreignKeyName: "shift_calendar_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
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
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
