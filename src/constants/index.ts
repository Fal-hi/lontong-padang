import type {
  NavItem,
  OrderSource,
  OrderStatus,
  PaymentStatus,
} from "../types";

export const APP_NAME = "Lontong Padang";
export const APP_VERSION = "1.0.0";

export const DEMO_CREDENTIALS = {
  username: "admin",
  password: "123456",
} as const;

export const NAV_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Dasbor", icon: "dashboard" },
  { page: "orders", label: "Pesanan", icon: "orders" },
  { page: "reports", label: "Laporan", icon: "reports" },
  { page: "menu", label: "Menu", icon: "menu" },
  { page: "calculator", label: "Kalkulator", icon: "calculator" },
  { page: "settings", label: "Pengaturan", icon: "settings" },
] as const;

export const ORDER_SOURCES: Array<{ value: OrderSource; label: string }> = [
  { value: "grab", label: "GrabFood" },
  { value: "gofood", label: "GoFood" },
  { value: "shopeefood", label: "ShopeeFood" },
  { value: "manual", label: "Manual" },
];

export function getOrderSourceLabel(source: OrderSource): string {
  return ORDER_SOURCES.find((s) => s.value === source)?.label ?? source;
}

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { color: string; label: string }
> = {
  baru: { color: "warning", label: "Baru" },
  diproses: { color: "info", label: "Diproses" },
  selesai: { color: "primary", label: "Selesai" },
  dibatalkan: { color: "danger", label: "Dibatalkan" },
};

export const ORDER_STATUS_OPTIONS: Array<{
  value: OrderStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Semua" },
  { value: "baru", label: "Baru" },
  { value: "diproses", label: "Diproses" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { color: string; label: string }
> = {
  dibayar: { color: "primary", label: "Dibayar" },
  belum_dibayar: { color: "warning", label: "Belum Dibayar" },
};

export const PAYMENT_STATUS_OPTIONS: Array<{
  value: PaymentStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Semua" },
  { value: "dibayar", label: "Dibayar" },
  { value: "belum_dibayar", label: "Belum Dibayar" },
];

export const MENU_CATEGORIES = [
  "Semua",
  "Lontong",
  "Tambahan",
  "Minuman",
] as const;

export const DEFAULT_ADDONS = [
  { id: "addon-telur", name: "Telur Bulat Balado", price: 5000 },
  { id: "addon-perkedel", name: "Perkedel Kentang", price: 5000 },
  { id: "addon-kerupuk", name: "Kerupuk", price: 2000 },
  { id: "addon-gorengan", name: "Gorengan", price: 1000 },
] as const;

export const CURRENCY = "IDR";
export const CURRENCY_SYMBOL = "Rp";

export const SPLASH_DURATION_MS = 2000;
export const LOGIN_LOADING_MS = 800;

// Centralized semantic chart palette (Mantine color tokens).
// revenue/sales = primary green, orders/counts = blue, completed = teal,
// pending = amber, cancelled = red.
export const CHART_COLORS = {
  revenue: "primary.6",
  orders: "info.6",
  completed: "primary.6",
  pending: "warning.6",
  cancelled: "danger.6",
} as const;

// Shared tooltip styling for all charts (works across light/dark chrome).
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#f3f4f6",
  fontSize: "12px",
} as const;

export const STORAGE_KEYS = {
  AUTH: "ricebox-auth",
  THEME: "ricebox-theme",
  ORDERS: "ricebox-orders",
  MENU: "ricebox-menu",
} as const;
