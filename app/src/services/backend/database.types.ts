// Generated from the Supabase schema (supabase/migrations/0001-0007). Regenerate after a migration;
// only the generic table helpers at the bottom of the generator output were dropped.
// get_order_private's columns are hand-corrected to nullable (the generator can't see that).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  created_at: string;
  full_name: string;
  hostel_block: string;
  id: string;
  phone: string;
  reg_no: string;
  updated_at: string;
  upi_vpa: string | null;
  /** From 0012. Absent before that migration is applied. */
  id_status?: 'none' | 'pending' | 'approved' | 'review' | 'rejected';
};

type OrderRow = {
  accepted_at: string | null;
  arrived_at: string | null;
  cancelled_at: string | null;
  courier_id: string | null;
  created_at: string;
  customer_id: string;
  delivered_at: string | null;
  drop_block: string;
  fare: number;
  handed_over_at: string | null;
  id: string;
  note: string;
  on_the_way_at: string | null;
  picked_up_at: string | null;
  pickup_point: string;
  pin_expiry: string | null;
  platform: string;
  rating: number | null;
  size: string;
  status: string;
  tracking_id: string;
  updated_at: string;
};

type OrderEventRow = {
  actor_id: string | null;
  created_at: string;
  detail: Json;
  event: string;
  from_status: string | null;
  id: number;
  order_id: string;
  to_status: string | null;
};

type ReportRow = {
  created_at: string;
  id: number;
  note: string;
  order_id: string;
  reason: string;
  reporter_id: string;
  reporter_role: string;
  resolved_at: string | null;
  status: string;
};

// Clients can't write any table directly (RLS + revoked grants); Insert/Update exist only to satisfy supabase-js.
type ReadOnly<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      profiles: ReadOnly<ProfileRow>;
      orders: ReadOnly<OrderRow>;
      order_events: ReadOnly<OrderEventRow>;
      reports: ReadOnly<ReportRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      save_profile: {
        Args: { p_reg_no: string; p_full_name: string; p_phone: string; p_hostel_block: string; p_upi?: string };
        Returns: ProfileRow;
      };
      quote_fare: { Args: { p_size: string }; Returns: number };
      place_order: {
        Args: {
          p_pickup_point: string;
          p_tracking_id: string;
          p_size: string;
          p_note?: string;
          p_pickup_otp?: string;
          p_driver_phone?: string;
        };
        Returns: OrderRow;
      };
      accept_order: { Args: { p_order: string }; Returns: string };
      advance_order: { Args: { p_order: string; p_to: string }; Returns: boolean };
      arrive_order: { Args: { p_order: string }; Returns: boolean };
      refresh_pin: { Args: { p_order: string }; Returns: boolean };
      verify_handover: { Args: { p_order: string; p_code: string }; Returns: string };
      complete_order: { Args: { p_order: string }; Returns: boolean };
      cancel_order: { Args: { p_order: string }; Returns: boolean };
      rate_order: { Args: { p_order: string; p_stars: number }; Returns: boolean };
      set_driver_phone: { Args: { p_order: string; p_phone: string }; Returns: boolean };
      report_order: { Args: { p_order: string; p_reason: string; p_note?: string }; Returns: boolean };
      get_order_private: {
        Args: { p_order: string };
        Returns: {
          my_role: string;
          delivery_pin: string | null;
          pin_expiry: string | null;
          pin_attempts_left: number;
          pickup_otp: string | null;
          driver_phone: string | null;
          other_name: string | null;
          other_reg_no: string | null;
          other_phone: string | null;
          other_upi: string | null;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type DbProfile = ProfileRow;
export type DbOrder = OrderRow;
export type DbOrderEvent = OrderEventRow;
export type DbReport = ReportRow;
