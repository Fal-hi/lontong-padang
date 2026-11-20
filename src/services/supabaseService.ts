import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../utils';
import type {
  CreateOrderInput,
  DailyFinancialSummary,
  DailySalesSummary,
  Expense,
  MenuAddon,
  MenuProduct,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Store,
  User,
} from '../types';
import type { Database } from '../types/database';

type DbOrderRow = Database['public']['Tables']['orders']['Row'];
type DbOrderItemRow = Database['public']['Tables']['order_items']['Row'];
type DbOrderItemAddonRow = Database['public']['Tables']['order_item_addons']['Row'];

interface RawOrderWithItems extends DbOrderRow {
  order_items: Array<
    DbOrderItemRow & {
      order_item_addons: DbOrderItemAddonRow[];
    }
  >;
}

// ----------------------------------------------------------------------------
// AUTH SERVICE
// ----------------------------------------------------------------------------
export const authService = {
  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { user: null, error: 'SUPABASE_NOT_CONFIGURED' };
    }

    const cleanEmail = email.trim();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.user) {
        const msg = (error?.message ?? '').toLowerCase();
        const status = (error as { status?: number } | null)?.status ?? 0;

        if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('connect') ||
          msg.includes('timeout') ||
          status >= 500
        ) {
          return { user: null, error: 'Tidak dapat terhubung ke server, coba lagi' };
        }

        return { user: null, error: 'Email atau kata sandi salah' };
      }

      const userProfile = await authService.getUserProfile(data.user.id);
      return { user: userProfile, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('connect') ||
        msg.includes('timeout')
      ) {
        return { user: null, error: 'Tidak dapat terhubung ke server, coba lagi' };
      }
      return { user: null, error: 'Email atau kata sandi salah' };
    }
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  },

  async getUserProfile(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, store_id, username, full_name, email, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      storeId: data.store_id ?? 'store-1',
      username: data.username,
      fullName: data.full_name,
      email: data.email,
      role: data.role === 'super_admin' ? 'super_admin' : 'staff',
      avatar: data.avatar_url ?? undefined,
    };
  },

  async getCurrentSessionUser(): Promise<User | null> {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return authService.getUserProfile(data.session.user.id);
  },
};

// ----------------------------------------------------------------------------
// STORE SERVICE
// ----------------------------------------------------------------------------
export const storeService = {
  async fetchStore(): Promise<Store | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('stores')
      .select('id, name, currency, address, phone, timezone')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      currency: data.currency,
      address: data.address ?? undefined,
      phone: data.phone ?? undefined,
      timezone: data.timezone,
    };
  },

  async updateStore(id: string, patch: Partial<Store>): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    const updatePayload: Database['public']['Tables']['stores']['Update'] = {};
    if (patch.name !== undefined) updatePayload.name = patch.name;
    if (patch.address !== undefined) updatePayload.address = patch.address;
    if (patch.phone !== undefined) updatePayload.phone = patch.phone;

    const { error } = await supabase
      .from('stores')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
};

// ----------------------------------------------------------------------------
// MENU SERVICE
// ----------------------------------------------------------------------------
export const menuService = {
  async fetchAddons(): Promise<MenuAddon[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('menu_addons')
      .select('id, name, price, is_active')
      .order('price', { ascending: true });

    if (error || !data) return [];

    return data.map((a) => ({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      active: a.is_active,
    }));
  },

  async fetchProducts(): Promise<MenuProduct[]> {
    if (!isSupabaseConfigured) return [];

    const { data: products, error } = await supabase
      .from('menu_products')
      .select('id, store_id, name, category, price, available, is_active')
      .order('category', { ascending: true });

    if (error || !products) return [];

    const { data: productAddons } = await supabase
      .from('product_addons')
      .select('product_id, addon_id');

    const addonMap = new Map<string, string[]>();
    for (const pa of productAddons ?? []) {
      const cur = addonMap.get(pa.product_id) ?? [];
      cur.push(pa.addon_id);
      addonMap.set(pa.product_id, cur);
    }

    return products.map((p) => ({
      id: p.id,
      storeId: p.store_id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      addonIds: addonMap.get(p.id) ?? [],
      available: p.available,
      active: p.is_active,
    }));
  },

  async addProduct(input: {
    storeId: string;
    name: string;
    category: string;
    price: number;
    addonIds: string[];
  }): Promise<{ id?: string; error?: string }> {
    if (!isSupabaseConfigured) return {};

    const { data, error } = await supabase
      .from('menu_products')
      .insert({
        store_id: input.storeId,
        name: input.name,
        category: input.category,
        price: input.price,
        available: true,
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !data) return { error: error?.message ?? 'Gagal menambah menu' };

    if (input.addonIds.length > 0) {
      const records = input.addonIds.map((addonId) => ({
        product_id: data.id,
        addon_id: addonId,
      }));
      await supabase.from('product_addons').insert(records);
    }

    return { id: data.id };
  },

  async toggleAvailable(id: string, current: boolean): Promise<boolean> {
    if (!isSupabaseConfigured) return !current;
    const { error } = await supabase
      .from('menu_products')
      .update({ available: !current })
      .eq('id', id);
    return !error;
  },

  async toggleActive(id: string, current: boolean): Promise<boolean> {
    if (!isSupabaseConfigured) return !current;
    const { error } = await supabase
      .from('menu_products')
      .update({ is_active: !current })
      .eq('id', id);
    return !error;
  },
};

// ----------------------------------------------------------------------------
// ORDERS SERVICE (ATOMIC RPC & IDEMPOTENCY)
// ----------------------------------------------------------------------------
export const orderService = {
  async fetchOrders(): Promise<Order[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        order_number,
        client_request_id,
        external_order_number,
        source,
        customer_name,
        order_date,
        notes,
        subtotal,
        addons_total,
        total,
        status,
        payment_status,
        day_key,
        created_by,
        completed_at,
        created_at,
        order_items (
          id,
          menu_id,
          menu_name,
          variant,
          quantity,
          unit_price,
          subtotal,
          note,
          order_item_addons (
            id,
            addon_id,
            addon_name,
            price,
            quantity,
            subtotal
          )
        )
      `)
      .order('order_date', { ascending: false });

    if (error || !data) return [];

    const rawRows = data as unknown as RawOrderWithItems[];

    return rawRows.map((o) => {
      const items: OrderItem[] = (o.order_items ?? []).map((i) => ({
        id: i.id,
        menuId: i.menu_id ?? '',
        menuName: i.menu_name,
        variant: i.variant ?? undefined,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        addons: (i.order_item_addons ?? []).map((a) => ({
          id: a.addon_id ?? a.id,
          name: a.addon_name,
          price: Number(a.price),
          quantity: a.quantity,
        })),
        note: i.note ?? undefined,
        subtotal: Number(i.subtotal),
      }));

      return {
        id: o.id,
        storeId: o.store_id,
        orderNumber: o.order_number,
        clientRequestId: o.client_request_id ?? undefined,
        externalOrderNumber: o.external_order_number ?? undefined,
        source: o.source,
        customerName: o.customer_name ?? undefined,
        orderDate: o.order_date,
        items,
        notes: o.notes ?? undefined,
        subtotal: Number(o.subtotal),
        addonsTotal: Number(o.addons_total),
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        completedAt: o.completed_at ?? undefined,
        createdBy: o.created_by ?? 'system',
        dayKey: o.day_key,
      };
    });
  },

  async createOrder(input: CreateOrderInput): Promise<{ order?: Order; error?: string }> {
    if (!isSupabaseConfigured) return {};

    const clientRequestId = input.clientRequestId || generateUUID();

    const payload = {
      client_request_id: clientRequestId ?? null,
      source: input.source,
      external_order_number: input.externalOrderNumber ?? null,
      customer_name: input.customerName ?? null,
      notes: input.notes ?? null,
      payment_status: input.paymentStatus,
      items: input.items.map((i) => ({
        menu_id: i.menuId,
        variant: i.variant ?? null,
        quantity: i.quantity,
        note: i.note ?? null,
        addons: i.addons.map((a) => ({
          addon_id: a.id,
          quantity: a.quantity,
        })),
      })),
    };

    const { data, error } = await supabase.rpc('create_order', {
      p_order: payload,
    });

    if (error || !data) {
      return { error: error?.message ?? 'Gagal menyimpan pesanan' };
    }

    const created = data as unknown as Order;
    return { order: created };
  },

  async changeStatus(
    orderId: string,
    status: OrderStatus,
    reason?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    if (status === 'dibatalkan') {
      const { error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
        p_reason: reason ?? 'Dibatalkan oleh kasir',
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    }

    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: status,
      p_reason: reason ?? null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async correctOrder(
    orderId: string,
    correction: {
      source: Order['source'];
      externalOrderNumber?: string;
      customerName?: string;
      items: OrderItem[];
      notes?: string;
      paymentStatus: PaymentStatus;
    },
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    const payload = {
      source: correction.source,
      external_order_number: correction.externalOrderNumber ?? null,
      customer_name: correction.customerName ?? null,
      notes: correction.notes ?? null,
      payment_status: correction.paymentStatus,
      items: correction.items.map((i) => ({
        menu_id: i.menuId,
        variant: i.variant ?? null,
        quantity: i.quantity,
        note: i.note ?? null,
        addons: i.addons.map((a) => ({
          addon_id: a.id,
          quantity: a.quantity,
        })),
      })),
    };

    const { error } = await supabase.rpc('correct_order', {
      p_order_id: orderId,
      p_correction: payload,
      p_reason: reason,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async togglePayment(
    orderId: string,
    reason?: string,
  ): Promise<{ ok: boolean; paymentStatus?: PaymentStatus; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    const { data, error } = await supabase.rpc('toggle_order_payment', {
      p_order_id: orderId,
      p_reason: reason ?? null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    const res = data as unknown as { paymentStatus?: PaymentStatus };
    return { ok: true, paymentStatus: res?.paymentStatus };
  },

  async closeDay(dayKey: string): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    const { error } = await supabase.rpc('close_store_day', {
      p_day_key: dayKey,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  async reopenDay(
    dayKey: string,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { ok: true };

    const { error } = await supabase.rpc('reopen_store_day', {
      p_day_key: dayKey,
      p_reason: reason,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
};

// ----------------------------------------------------------------------------
// EXPENSES SERVICE (SUPER_ADMIN ONLY)
// ----------------------------------------------------------------------------
export const expenseService = {
  async fetchExpenses(): Promise<Expense[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('expenses')
      .select('id, store_id, category, description, amount, expense_date, day_key, receipt_url, created_by, created_at')
      .order('expense_date', { ascending: false });

    if (error || !data) return [];

    return data.map((e) => ({
      id: e.id,
      storeId: e.store_id,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      expenseDate: e.expense_date,
      dayKey: e.day_key,
      receiptUrl: e.receipt_url ?? undefined,
      createdBy: e.created_by ?? undefined,
      createdAt: e.created_at,
    }));
  },

  async addExpense(input: {
    storeId: string;
    category: string;
    description: string;
    amount: number;
    expenseDate?: string;
    receiptUrl?: string;
  }): Promise<{ id?: string; error?: string }> {
    if (!isSupabaseConfigured) return {};

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        store_id: input.storeId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        expense_date: input.expenseDate,
        receipt_url: input.receiptUrl ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { error: error?.message ?? 'Gagal mencatat pengeluaran' };
    }
    return { id: data.id };
  },
};

// ----------------------------------------------------------------------------
// REPORTS SERVICE (SECURITY DEFINER RPCS)
// ----------------------------------------------------------------------------
export const reportService = {
  async fetchSalesSummary(from: string, to: string): Promise<DailySalesSummary[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase.rpc('get_sales_summary', {
      p_from: from,
      p_to: to,
    });

    if (error || !data) return [];
    const list = data as unknown as Array<{
      day_key: string;
      total_orders: number;
      gross_sales: number;
      completed_count: number;
      completed_sales: number;
      paid_completed_sales?: number;
      cancelled_count: number;
      cancelled_amount: number;
      unpaid_count: number;
      unpaid_amount: number;
    }>;

    return list.map((r) => ({
      dayKey: r.day_key,
      totalOrders: Number(r.total_orders),
      grossSales: Number(r.gross_sales),
      completedCount: Number(r.completed_count),
      completedSales: Number(r.completed_sales),
      paidCompletedSales: r.paid_completed_sales !== undefined ? Number(r.paid_completed_sales) : undefined,
      cancelledCount: Number(r.cancelled_count),
      cancelledAmount: Number(r.cancelled_amount),
      unpaidCount: Number(r.unpaid_count),
      unpaidAmount: Number(r.unpaid_amount),
    }));
  },

  async fetchFinancialSummary(from: string, to: string): Promise<DailyFinancialSummary[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase.rpc('get_financial_summary', {
      p_from: from,
      p_to: to,
    });

    if (error || !data) return [];
    const list = data as unknown as Array<{
      day_key: string;
      total_orders: number;
      gross_sales: number;
      completed_sales: number;
      paid_completed_sales?: number;
      cancelled_sales?: number;
      cancelled_amount?: number;
      unpaid_amount: number;
      total_expense: number;
      net_profit: number;
    }>;

    return list.map((r) => ({
      dayKey: r.day_key,
      totalOrders: Number(r.total_orders),
      grossSales: Number(r.gross_sales),
      completedSales: Number(r.completed_sales),
      paidCompletedSales: r.paid_completed_sales !== undefined ? Number(r.paid_completed_sales) : undefined,
      cancelledSales: Number(r.cancelled_sales ?? r.cancelled_amount ?? 0),
      unpaidAmount: Number(r.unpaid_amount),
      totalExpense: Number(r.total_expense),
      netProfit: Number(r.net_profit),
    }));
  },

  async fetchBestSellingMenu(from?: string, to?: string): Promise<Array<{ menuId: string; name: string; quantity: number; sales: number }>> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase.rpc('get_best_selling_menu', {
      p_from: from ?? null,
      p_to: to ?? null,
    });

    if (error || !data) return [];
    const list = data as unknown as Array<{
      menu_id: string;
      menu_name: string;
      total_quantity: number;
      total_sales: number;
    }>;

    return list.map((r) => ({
      menuId: r.menu_id,
      name: r.menu_name,
      quantity: Number(r.total_quantity),
      sales: Number(r.total_sales),
    }));
  },
};
