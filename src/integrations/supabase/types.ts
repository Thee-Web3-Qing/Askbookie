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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_plans: {
        Row: {
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          charged_at: string | null
          cost: number
          day: string
          id: string
          replies: number
          vendor_id: string
        }
        Insert: {
          charged_at?: string | null
          cost?: number
          day: string
          id?: string
          replies?: number
          vendor_id: string
        }
        Update: {
          charged_at?: string | null
          cost?: number
          day?: string
          id?: string
          replies?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          addon_ids: string[]
          agreed_price: number | null
          ai_paused: boolean
          bucket: string
          created_at: string
          customer_access_hash: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          deposit_amount: number | null
          deposit_paid_at: string | null
          end_at: string | null
          escalation_reason: string | null
          hold_expires_at: string | null
          id: string
          last_counter: number | null
          location_area: string
          negotiation_rounds: number
          party_size: number
          payment_reference: string | null
          service_id: string | null
          service_mode: string
          start_at: string | null
          status: string
          total_price: number | null
          travel_fee: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          addon_ids?: string[]
          agreed_price?: number | null
          ai_paused?: boolean
          bucket?: string
          created_at?: string
          customer_access_hash?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          end_at?: string | null
          escalation_reason?: string | null
          hold_expires_at?: string | null
          id?: string
          last_counter?: number | null
          location_area?: string
          negotiation_rounds?: number
          party_size?: number
          payment_reference?: string | null
          service_id?: string | null
          service_mode?: string
          start_at?: string | null
          status?: string
          total_price?: number | null
          travel_fee?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          addon_ids?: string[]
          agreed_price?: number | null
          ai_paused?: boolean
          bucket?: string
          created_at?: string
          customer_access_hash?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          end_at?: string | null
          escalation_reason?: string | null
          hold_expires_at?: string | null
          id?: string
          last_counter?: number | null
          location_area?: string
          negotiation_rounds?: number
          party_size?: number
          payment_reference?: string | null
          service_id?: string | null
          service_mode?: string
          start_at?: string | null
          status?: string
          total_price?: number | null
          travel_fee?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          amount: number | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          note: string
          vendor_id: string
        }
        Insert: {
          amount?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string
          vendor_id: string
        }
        Update: {
          amount?: number | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          role: string
          ui_message: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          ui_message: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          ui_message?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string
          country: string
          created_at: string
          display_name: string
          id: string
          phone: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          display_name?: string
          id: string
          phone?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string
          duration_minutes: number
          floor_price: number
          group_price_per_person: number | null
          id: string
          is_addon: boolean
          list_price: number
          name: string
          preferred_price: number
          vendor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          floor_price: number
          group_price_per_person?: number | null
          id?: string
          is_addon?: boolean
          list_price: number
          name: string
          preferred_price: number
          vendor_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          floor_price?: number
          group_price_per_person?: number | null
          id?: string
          is_addon?: boolean
          list_price?: number
          name?: string
          preferred_price?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          area: string
          blocked_dates: string[]
          buffer_minutes: number
          business_name: string
          cancellation_policy: string
          category: string
          city: string
          country: string
          created_at: string
          currency: string
          deposit_type: string
          deposit_value: number
          description: string
          escalate_group_over: number
          hold_minutes: number
          id: string
          is_listed: boolean
          location_fees: Json
          max_bookings_per_day: number
          min_notice_hours: number
          negotiation: Json
          outside_area_rule: string
          owner_id: string
          owner_name: string
          service_modes: string[]
          slug: string
          studio_address: string
          timezone: string
          working_hours: Json
        }
        Insert: {
          area?: string
          blocked_dates?: string[]
          buffer_minutes?: number
          business_name: string
          cancellation_policy?: string
          category?: string
          city?: string
          country?: string
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description?: string
          escalate_group_over?: number
          hold_minutes?: number
          id?: string
          is_listed?: boolean
          location_fees?: Json
          max_bookings_per_day?: number
          min_notice_hours?: number
          negotiation?: Json
          outside_area_rule?: string
          owner_id: string
          owner_name?: string
          service_modes?: string[]
          slug: string
          studio_address?: string
          timezone?: string
          working_hours?: Json
        }
        Update: {
          area?: string
          blocked_dates?: string[]
          buffer_minutes?: number
          business_name?: string
          cancellation_policy?: string
          category?: string
          city?: string
          country?: string
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description?: string
          escalate_group_over?: number
          hold_minutes?: number
          id?: string
          is_listed?: boolean
          location_fees?: Json
          max_bookings_per_day?: number
          min_notice_hours?: number
          negotiation?: Json
          outside_area_rule?: string
          owner_id?: string
          owner_name?: string
          service_modes?: string[]
          slug?: string
          studio_address?: string
          timezone?: string
          working_hours?: Json
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount: number
          created_at: string
          day: string | null
          id: string
          kind: string
          note: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          day?: string | null
          id?: string
          kind: string
          note?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          day?: string | null
          id?: string
          kind?: string
          note?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
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
      ai_can_reply: { Args: { _vendor: string }; Returns: boolean }
      ai_reply_price: { Args: never; Returns: number }
      charge_daily_ai_usage: { Args: never; Returns: number }
      ensure_wallet: { Args: { _user: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_customer_slot_atomic: {
        Args: {
          _agreed_price: number
          _conversation_id: string
          _customer_name: string
          _customer_phone: string
          _deposit_amount: number
          _end_at: string
          _hold_expires_at: string
          _start_at: string
          _total_price: number
        }
        Returns: boolean
      }
      owns_vendor: { Args: { _vendor: string }; Returns: boolean }
      record_ai_reply: { Args: { _vendor: string }; Returns: undefined }
    }
    Enums: {
      app_role: "vendor" | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["vendor", "customer"],
    },
  },
} as const
