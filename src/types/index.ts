// ---------------------------------------------------------------------------
// Domain model for RiceBox — Order Recording & Sales Management Dashboard
// NOTE: Frontend state (Zustand/localStorage) is a MOCK source of truth.
// Final enforcement of immutability, audit, permissions, ownership, and daily
// closing must live on a backend/database. This model is designed to map 1:1
// to future API entities (storeId on every record, ISO timestamps, etc.).
// ---------------------------------------------------------------------------

export type NavPage =
  | 'dashboard'
  | 'orders'
  | 'menu'
  | 'calculator'
  | 'reports'
  | 'settings';

export type ColorScheme = 'light' | 'dark';

export type UserRole = 'owner' | 'super_admin' | 'staff';

export interface User {
  id: string;
  storeId: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Expense {
  id: string;
  storeId: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  dayKey: string;
  receiptUrl?: string;
  createdBy?: string;
  createdAt: string;
}

export interface DailySalesSummary {
  dayKey: string;
  totalOrders: number;
  grossSales: number;
  completedCount: number;
  completedSales: number;
  paidCompletedSales?: number;
  cancelledCount: number;
  cancelledAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
}

export interface DailyFinancialSummary {
  dayKey: string;
  totalOrders: number;
  grossSales: number;
  completedSales: number;
  paidCompletedSales?: number;
  cancelledSales: number;
  unpaidAmount: number;
  totalExpense: number;
  netProfit: number;
}

export interface Store {
  id: string;
  name: string;
  currency: string;
  address?: string;
  phone?: string;
  timezone: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginError {
  field?: 'email' | 'password' | 'general';
  message: string;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderSource = 'grab' | 'gofood' | 'shopeefood' | 'manual';

export type OrderStatus = 'baru' | 'diproses' | 'selesai' | 'dibatalkan';

export type PaymentStatus = 'dibayar' | 'belum_dibayar';

export interface OrderAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderItem {
  id: string;
  menuId: string;
  menuName: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  addons: OrderAddon[];
  note?: string;
  subtotal: number; // (unitPrice * quantity) + addons
}

export interface Order {
  id: string; // internal UUID
  storeId: string;
  orderNumber: string; // internal, e.g. LP-20260803-0001
  clientRequestId?: string; // Idempotency key
  externalOrderNumber?: string; // platform reference number
  source: OrderSource;
  customerName?: string;
  orderDate: string; // ISO timestamp of the order
  items: OrderItem[];
  notes?: string;
  subtotal: number; // sum of item subtotals (before add-ons rounding issues)
  addonsTotal: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string; // ISO recorded timestamp
  completedAt?: string; // ISO when marked Selesai
  createdBy: string; // userId
  dayKey: string; // YYYY-MM-DD for daily grouping / closing
}

export interface CreateOrderInput {
  storeId: string;
  clientRequestId?: string;
  source: OrderSource;
  externalOrderNumber?: string;
  customerName?: string;
  orderDate: string;
  items: Array<{
    menuId: string;
    menuName: string;
    variant?: string;
    quantity: number;
    unitPrice: number;
    addons: OrderAddon[];
    note?: string;
  }>;
  notes?: string;
  paymentStatus: PaymentStatus;
  createdBy: string;
  orderNumber: string;
}

export interface OrderCorrection {
  id: string;
  orderId: string;
  reason: string;
  oldValue: Partial<Order>;
  newValue: Partial<Order>;
  correctedAt: string;
  correctedBy: string;
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export interface MenuAddon {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

export interface MenuProduct {
  id: string;
  storeId: string;
  name: string;
  category: string;
  price: number;
  addonIds: string[];
  available: boolean; // sold out today
  active: boolean; // shown on menu / usable in orders
  ordersCount?: number;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_CORRECTED'
  | 'PAYMENT_UPDATED'
  | 'DAY_CLOSED'
  | 'DAY_REOPENED';

export interface AuditLog {
  id: string;
  storeId: string;
  orderId?: string;
  actionType: AuditAction;
  userId: string;
  userName: string;
  timestamp: string; // ISO
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Daily closing
// ---------------------------------------------------------------------------

export interface PlatformSummary {
  orders: number;
  sales: number;
  cancelled: number;
  cancelledAmount: number;
  unpaid: number;
  unpaidAmount: number;
}

export type PlatformBreakdown = Record<OrderSource, PlatformSummary>;

export interface DaySummary {
  totalOrders: number;
  grossSales: number;
  completedCount: number;
  completedSales: number;
  cancelledCount: number;
  cancelledAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  avgOrderValue: number;
  byPlatform: PlatformBreakdown;
  bestSelling: { menuId: string; name: string; quantity: number } | null;
}

export interface DailyClose {
  id: string;
  storeId: string;
  dayKey: string; // YYYY-MM-DD
  closedAt: string; // ISO
  closedBy: string;
  userName: string;
  summary: DaySummary;
}

// ---------------------------------------------------------------------------
// Stats / UI helpers
// ---------------------------------------------------------------------------

export interface StatItem {
  label: string;
  value: number | string;
  icon: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  isPrice?: boolean;
}

export interface QuickAction {
  label: string;
  icon: string;
  color: string;
  description?: string;
  page?: NavPage;
  action?: 'new-order';
}

export interface NavItem {
  page: NavPage;
  label: string;
  icon: string;
}

export type DateFilter = 'today' | 'yesterday' | 'week' | 'all';

export interface OrderFilters {
  search: string;
  date: string | null; // dayKey or null
  source: OrderSource | 'all';
  status: OrderStatus | 'all';
  payment: PaymentStatus | 'all';
}
