export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'super_admin' | 'staff';
export type OrderSource = 'grab' | 'gofood' | 'shopeefood' | 'manual';
export type OrderStatus = 'baru' | 'diproses' | 'selesai' | 'dibatalkan';
export type PaymentStatus = 'dibayar' | 'belum_dibayar';
export type AuditAction =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_CORRECTED'
  | 'PAYMENT_UPDATED'
  | 'DAY_CLOSED';

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          currency: string;
          address: string | null;
          phone: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          currency?: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          currency?: string;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          store_id: string | null;
          username: string;
          full_name: string;
          email: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          store_id?: string | null;
          username: string;
          full_name: string;
          email: string;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string | null;
          username?: string;
          full_name?: string;
          email?: string;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_products: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          category: string;
          price: number;
          available: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          category: string;
          price: number;
          available?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          category?: string;
          price?: number;
          available?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      menu_addons: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          price: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_addons_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      product_addons: {
        Row: {
          product_id: string;
          addon_id: string;
        };
        Insert: {
          product_id: string;
          addon_id: string;
        };
        Update: {
          product_id?: string;
          addon_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_addons_addon_id_fkey';
            columns: ['addon_id'];
            isOneToOne: false;
            referencedRelation: 'menu_addons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_addons_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'menu_products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          order_number: string;
          client_request_id: string | null;
          external_order_number: string | null;
          source: OrderSource;
          customer_name: string | null;
          order_date: string;
          notes: string | null;
          subtotal: number;
          addons_total: number;
          total: number;
          status: OrderStatus;
          payment_status: PaymentStatus;
          day_key: string;
          created_by: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_number: string;
          client_request_id?: string | null;
          external_order_number?: string | null;
          source?: OrderSource;
          customer_name?: string | null;
          order_date?: string;
          notes?: string | null;
          subtotal?: number;
          addons_total?: number;
          total?: number;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          day_key?: string;
          created_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          order_number?: string;
          client_request_id?: string | null;
          external_order_number?: string | null;
          source?: OrderSource;
          customer_name?: string | null;
          order_date?: string;
          notes?: string | null;
          subtotal?: number;
          addons_total?: number;
          total?: number;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          day_key?: string;
          created_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_id: string | null;
          menu_name: string;
          variant: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_id?: string | null;
          menu_name: string;
          variant?: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_id?: string | null;
          menu_name?: string;
          variant?: string | null;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_item_addons: {
        Row: {
          id: string;
          order_item_id: string;
          addon_id: string | null;
          addon_name: string;
          price: number;
          quantity: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          addon_id?: string | null;
          addon_name: string;
          price: number;
          quantity?: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_item_id?: string;
          addon_id?: string | null;
          addon_name?: string;
          price?: number;
          quantity?: number;
          subtotal?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_item_addons_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          store_id: string;
          category: string;
          description: string;
          amount: number;
          expense_date: string;
          day_key: string;
          receipt_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category: string;
          description: string;
          amount: number;
          expense_date?: string;
          day_key?: string;
          receipt_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          category?: string;
          description?: string;
          amount?: number;
          expense_date?: string;
          day_key?: string;
          receipt_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_closings: {
        Row: {
          id: string;
          store_id: string;
          day_key: string;
          closed_at: string;
          closed_by: string | null;
          user_name: string;
          summary: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          day_key: string;
          closed_at?: string;
          closed_by?: string | null;
          user_name: string;
          summary: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          day_key?: string;
          closed_at?: string;
          closed_by?: string | null;
          user_name?: string;
          summary?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_closings_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      order_corrections: {
        Row: {
          id: string;
          order_id: string;
          reason: string;
          old_value: Json;
          new_value: Json;
          corrected_by: string | null;
          corrected_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          reason: string;
          old_value: Json;
          new_value: Json;
          corrected_by?: string | null;
          corrected_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          reason?: string;
          old_value?: Json;
          new_value?: Json;
          corrected_by?: string | null;
          corrected_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_corrections_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          store_id: string;
          order_id: string | null;
          action_type: AuditAction;
          user_id: string | null;
          user_name: string;
          old_value: Json | null;
          new_value: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_id?: string | null;
          action_type: AuditAction;
          user_id?: string | null;
          user_name: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          order_id?: string | null;
          action_type?: AuditAction;
          user_id?: string | null;
          user_name?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_order: {
        Args: {
          p_order: Json;
        };
        Returns: Json;
      };
      update_order_status: {
        Args: {
          p_order_id: string;
          p_status: OrderStatus;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      cancel_order: {
        Args: {
          p_order_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      correct_order: {
        Args: {
          p_order_id: string;
          p_correction: Json;
          p_reason: string;
        };
        Returns: Json;
      };
      toggle_order_payment: {
        Args: {
          p_order_id: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      close_store_day: {
        Args: {
          p_day_key: string;
        };
        Returns: Json;
      };
      reopen_store_day: {
        Args: {
          p_day_key: string;
          p_reason: string;
        };
        Returns: Json;
      };
      get_sales_summary: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Json;
      };
      get_financial_summary: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Json;
      };
      get_best_selling_menu: {
        Args: {
          p_from?: string | null;
          p_to?: string | null;
        };
        Returns: Json;
      };
      get_current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_current_user_store_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_staff_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      order_source: OrderSource;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      audit_action: AuditAction;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
