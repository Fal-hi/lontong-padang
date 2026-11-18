import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AuditLog,
  CreateOrderInput,
  Order,
  OrderStatus,
  OrderItem,
  PaymentStatus,
} from '../types';
import { STORAGE_KEYS } from '../constants';
import {
  computeOrderTotals,
  generateId,
  nextOrderNumber,
  todayKey,
  toDayKey,
  computeDaySummary,
} from '../utils';
import { mockAuditLogs, mockOrders } from '../mock';
import { useAuthStore } from './authStore';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface OrderState {
  orders: Order[];
  auditLogs: AuditLog[];
  closedDays: string[];
  addOrder: (input: CreateOrderInput) => Order;
  changeStatus: (
    orderId: string,
    status: OrderStatus,
    reason?: string,
  ) => ActionResult;
  togglePayment: (orderId: string, reason?: string) => ActionResult;
  correctOrder: (
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
  ) => ActionResult;
  closeDay: (dayKey: string) => ActionResult;
  getDayOrders: (dayKey: string) => Order[];
}

function currentUser() {
  return useAuthStore.getState().user;
}

function makeAuditLog(
  actionType: AuditLog['actionType'],
  order: Order,
  extra?: {
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  },
): AuditLog {
  const user = currentUser();
  return {
    id: generateId(),
    storeId: order.storeId,
    orderId: order.id,
    actionType,
    userId: user?.id ?? 'system',
    userName: user?.fullName ?? 'Sistem',
    timestamp: new Date().toISOString(),
    oldValue: extra?.oldValue,
    newValue: extra?.newValue,
    reason: extra?.reason,
  };
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: mockOrders,
      auditLogs: mockAuditLogs,
      closedDays: [],

      getDayOrders: (dayKey) =>
        get().orders.filter((o) => o.dayKey === dayKey),

      addOrder: (input) => {
        const state = get();
        const orderDate = input.orderDate || new Date().toISOString();
        const dayKey = toDayKey(new Date(orderDate));
        const orderNumber = nextOrderNumber(dayKey, state.orders);
        const totals = computeOrderTotals(input.items);

        const items: OrderItem[] = input.items.map((i) => ({
          id: generateId(),
          menuId: i.menuId,
          menuName: i.menuName,
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          addons: i.addons,
          note: i.note,
          subtotal:
            i.quantity * i.unitPrice +
            i.addons.reduce((s, a) => s + a.price * a.quantity, 0),
        }));

        const user = currentUser();
        const order: Order = {
          id: generateId(),
          storeId: input.storeId,
          orderNumber,
          externalOrderNumber: input.externalOrderNumber?.trim() || undefined,
          source: input.source,
          customerName: input.customerName?.trim() || undefined,
          orderDate,
          items,
          notes: input.notes?.trim() || undefined,
          subtotal: totals.subtotal,
          addonsTotal: totals.addonsTotal,
          total: totals.total,
          status: 'baru',
          paymentStatus: input.paymentStatus,
          createdAt: new Date().toISOString(),
          completedAt: undefined,
          createdBy: user?.id ?? 'system',
          dayKey,
        };

        set((s) => ({
          orders: [order, ...s.orders],
          auditLogs: [makeAuditLog('ORDER_CREATED', order), ...s.auditLogs],
        }));
        return order;
      },

      changeStatus: (orderId, status, reason) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: 'Pesanan tidak ditemukan' };
        if (order.status === status)
          return { ok: false, error: 'Status sudah sama' };

        const dayClosed = state.closedDays.includes(order.dayKey);

        if (order.status === 'dibatalkan' || order.status === 'selesai') {
          return {
            ok: false,
            error:
              'Pesanan selesai/dibatalkan bersifat final. Gunakan Koreksi Pesanan atau Batalkan Pesanan dengan alasan.',
          };
        }

        if (status === 'dibatalkan') {
          if (!reason?.trim())
            return {
              ok: false,
              error: 'Pembatalan wajib disertai alasan',
            };
        } else if (dayClosed && !reason?.trim()) {
          return {
            ok: false,
            error:
              'Hari sudah ditutup, perubahan status memerlukan alasan.',
          };
        }

        const updated: Order = {
          ...order,
          status,
          completedAt:
            status === 'selesai' ? new Date().toISOString() : order.completedAt,
        };

        const actionType =
          status === 'selesai'
            ? ('ORDER_COMPLETED' as const)
            : ('ORDER_STATUS_CHANGED' as const);

        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
          auditLogs: [
            makeAuditLog(actionType, updated, {
              oldValue: order.status,
              newValue: status,
              reason: reason?.trim() || undefined,
            }),
            ...s.auditLogs,
          ],
        }));
        return { ok: true };
      },

      togglePayment: (orderId, reason) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: 'Pesanan tidak ditemukan' };
        if (order.status === 'dibatalkan')
          return {
            ok: false,
            error: 'Pesanan dibatalkan tidak dapat mengubah status pembayaran',
          };

        const dayClosed = state.closedDays.includes(order.dayKey);
        if (dayClosed && !reason?.trim()) {
          return {
            ok: false,
            error: 'Hari sudah ditutup. Pembayaran diubah memerlukan alasan.',
          };
        }

        const next: PaymentStatus =
          order.paymentStatus === 'dibayar' ? 'belum_dibayar' : 'dibayar';
        const updated: Order = { ...order, paymentStatus: next };

        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
          auditLogs: [
            makeAuditLog('PAYMENT_UPDATED', updated, {
              oldValue: order.paymentStatus,
              newValue: next,
              reason: reason?.trim() || undefined,
            }),
            ...s.auditLogs,
          ],
        }));
        return { ok: true };
      },

      correctOrder: (orderId, correction, reason) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: 'Pesanan tidak ditemukan' };
        if (!reason.trim())
          return { ok: false, error: 'Koreksi wajib disertai alasan' };

        const totals = computeOrderTotals(correction.items);

        const oldValue = {
          source: order.source,
          externalOrderNumber: order.externalOrderNumber,
          customerName: order.customerName,
          items: order.items,
          notes: order.notes,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          addonsTotal: order.addonsTotal,
          total: order.total,
        };

        const updated: Order = {
          ...order,
          source: correction.source,
          externalOrderNumber: correction.externalOrderNumber?.trim() || undefined,
          customerName: correction.customerName?.trim() || undefined,
          items: correction.items,
          notes: correction.notes?.trim() || undefined,
          paymentStatus: correction.paymentStatus,
          subtotal: totals.subtotal,
          addonsTotal: totals.addonsTotal,
          total: totals.total,
        };

        const newValue = {
          source: updated.source,
          externalOrderNumber: updated.externalOrderNumber,
          customerName: updated.customerName,
          items: updated.items,
          notes: updated.notes,
          paymentStatus: updated.paymentStatus,
          subtotal: updated.subtotal,
          addonsTotal: updated.addonsTotal,
          total: updated.total,
        };

        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
          auditLogs: [
            makeAuditLog('ORDER_CORRECTED', updated, {
              oldValue,
              newValue,
              reason: reason.trim(),
            }),
            ...s.auditLogs,
          ],
        }));
        return { ok: true };
      },

      closeDay: (dayKey) => {
        const state = get();
        if (state.closedDays.includes(dayKey))
          return { ok: false, error: 'Hari ini sudah ditutup' };

        const dayOrders = state.orders.filter((o) => o.dayKey === dayKey);
        const open = dayOrders.filter(
          (o) => o.status !== 'selesai' && o.status !== 'dibatalkan',
        );
        if (open.length > 0) {
          return {
            ok: false,
            error: `Terdapat ${open.length} pesanan yang belum selesai (${open
              .map((o) => o.orderNumber)
              .join(', ')}). Selesaikan atau batalkan dulu.`,
          };
        }

        const summary = computeDaySummary(dayOrders);

        set((s) => {
          const storeId = dayOrders[0]?.storeId ?? s.orders[0]?.storeId ?? '';
          const user = currentUser();
          const log: AuditLog = {
            id: generateId(),
            storeId,
            orderId: undefined,
            actionType: 'DAY_CLOSED',
            userId: user?.id ?? 'system',
            userName: user?.fullName ?? 'Sistem',
            timestamp: new Date().toISOString(),
            newValue: summary,
          };
          return {
            closedDays: [...s.closedDays, dayKey],
            auditLogs: [log, ...s.auditLogs],
          };
        });
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEYS.ORDERS,
      version: 3,
      migrate: () => ({
        orders: mockOrders,
        auditLogs: mockAuditLogs,
        closedDays: [],
      }),
    },
  ),
);

export function useDaySummary(dayKey: string) {
  const allOrders = useOrderStore((s) => s.orders);
  const closedDays = useOrderStore((s) => s.closedDays);
  const orders = allOrders.filter((o) => o.dayKey === dayKey);
  const today = todayKey();
  return {
    orders,
    isClosed: closedDays.includes(dayKey),
    isToday: dayKey === today,
  };
}
