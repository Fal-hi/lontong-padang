import type {
  DaySummary,
  Order,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  PlatformBreakdown,
} from "../types";
import {
  CURRENCY,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from "../constants";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `Rp ${(amount / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} rb`;
  }
  return `Rp ${amount}`;
}

/**
 * Format ringkas nilai angka untuk label sumbu Y pada chart (tanpa prefix Rp agar hemat ruang).
 * Contoh: 0 -> "0", 250000 -> "250rb", 1500000 -> "1,5jt", 2000000 -> "2jt"
 */
export function formatChartYAxis(amount: number): string {
  if (!amount || amount === 0) return '0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}${val.toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}${val.toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}${val.toLocaleString('id-ID', { maximumFractionDigits: 1 })}rb`;
  }
  return `${sign}${abs}`;
}

export function formatCurrentDate(): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Selamat pagi";
  if (hour < 17) return "Selamat siang";
  return "Selamat malam";
}

// ---------------------------------------------------------------------------
// Date / day keys
// ---------------------------------------------------------------------------

export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export function formatDateIndonesia(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function todayLabel(): string {
  return formatDateIndonesia(new Date());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status]?.label ?? status;
}

export function getOrderStatusColor(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status]?.color ?? "gray";
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_CONFIG[status]?.label ?? status;
}

export function getPaymentStatusColor(status: PaymentStatus): string {
  return PAYMENT_STATUS_CONFIG[status]?.color ?? "gray";
}

// ---------------------------------------------------------------------------
// Order number generation
// ---------------------------------------------------------------------------

export function nextOrderNumber(dayKey: string, existing: Order[]): string {
  const prefix = `LP-${dayKey.replaceAll("-", "")}`;
  const dayOrders = existing.filter((o) => o.dayKey === dayKey);
  const maxSeq = dayOrders.reduce((max, o) => {
    const seq = Number(o.orderNumber.split("-").pop() ?? "0");
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Order calculations
// ---------------------------------------------------------------------------

export function computeItemSubtotal(item: {
  quantity: number;
  unitPrice: number;
  addons: Array<{ price: number; quantity: number }>;
}): number {
  const base = item.quantity * item.unitPrice;
  const addons = item.addons.reduce((sum, a) => sum + a.price * a.quantity, 0);
  return base + addons;
}

export function computeOrderTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    addons: Array<{ price: number; quantity: number }>;
  }>,
): { subtotal: number; addonsTotal: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const addonsTotal = items.reduce(
    (sum, i) => sum + i.addons.reduce((s, a) => s + a.price * a.quantity, 0),
    0,
  );
  return { subtotal, addonsTotal, total: subtotal + addonsTotal };
}

// ---------------------------------------------------------------------------
// Sales summary (computed from recorded orders — never manually edited)
// ---------------------------------------------------------------------------

export function emptyPlatformSummary() {
  const base = {
    orders: 0,
    sales: 0,
    cancelled: 0,
    cancelledAmount: 0,
    unpaid: 0,
    unpaidAmount: 0,
  };
  return {
    grab: { ...base },
    gofood: { ...base },
    shopeefood: { ...base },
    manual: { ...base },
  } satisfies PlatformBreakdown;
}

export function computeDaySummary(orders: Order[]): DaySummary {
  const byPlatform = emptyPlatformSummary();
  let grossSales = 0;
  let completedCount = 0;
  let completedSales = 0;
  let cancelledCount = 0;
  let cancelledAmount = 0;
  let unpaidCount = 0;
  let unpaidAmount = 0;
  const itemQty = new Map<string, { name: string; quantity: number }>();

  for (const order of orders) {
    const platform = byPlatform[order.source];
    platform.orders += 1;
    platform.sales += order.total;
    if (order.status === "dibatalkan") {
      platform.cancelled += 1;
      platform.cancelledAmount += order.total;
    }
    if (
      order.status !== "dibatalkan" &&
      order.paymentStatus === "belum_dibayar"
    ) {
      platform.unpaid += 1;
      platform.unpaidAmount += order.total;
    }

    for (const item of order.items) {
      const cur = itemQty.get(item.menuId);
      if (cur) cur.quantity += item.quantity;
      else
        itemQty.set(item.menuId, {
          name: item.menuName,
          quantity: item.quantity,
        });
    }

    if (order.status === "selesai") {
      completedCount += 1;
      completedSales += order.total;
    }
    if (order.status === "dibatalkan") {
      cancelledCount += 1;
      cancelledAmount += order.total;
    } else {
      grossSales += order.total;
      if (order.paymentStatus === "belum_dibayar") {
        unpaidCount += 1;
        unpaidAmount += order.total;
      }
    }
  }

  let bestSelling: DaySummary["bestSelling"] = null;
  for (const [menuId, entry] of itemQty.entries()) {
    if (!bestSelling || entry.quantity > bestSelling.quantity) {
      bestSelling = { menuId, name: entry.name, quantity: entry.quantity };
    }
  }

  const activeOrders = orders.filter((o) => o.status !== "dibatalkan").length;
  const avgOrderValue = activeOrders > 0 ? grossSales / activeOrders : 0;

  return {
    totalOrders: orders.length,
    grossSales,
    completedCount,
    completedSales,
    cancelledCount,
    cancelledAmount,
    unpaidCount,
    unpaidAmount,
    avgOrderValue,
    byPlatform,
    bestSelling,
  };
}

export function sumPlatforms(breakdown: PlatformBreakdown): {
  orders: number;
  sales: number;
} {
  let orders = 0;
  let sales = 0;
  for (const key of Object.keys(breakdown) as OrderSource[]) {
    orders += breakdown[key].orders;
    sales += breakdown[key].sales;
  }
  return { orders, sales };
}
