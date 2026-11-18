import { useMemo, useState } from 'react';
import { Modal, Textarea } from '@mantine/core';
import type {
  AuditLog,
  MenuProduct,
  OrderItem,
  OrderSource,
  PaymentStatus,
} from '../../types';
import { useOrderStore } from '../../stores/orderStore';
import { useNavStore } from '../../stores/navStore';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';
import {
  formatCurrency,
  formatDateTime,
  generateId,
} from '../../utils';
import PlatformBadge from '../../components/PlatformBadge';
import StatusBadge from '../../components/StatusBadge';
import PaymentBadge from '../../components/PaymentBadge';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  HistoryIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  MinusIcon,
  RotateCcwIcon,
  TrashIcon,
  XCircleIcon,
} from '../../utils/icons';

const ACTION_META: Record<
  AuditLog['actionType'],
  { icon: string; label: string; color: string }
> = {
  ORDER_CREATED: { icon: 'plus', label: 'Pesanan dibuat', color: '#059669' },
  ORDER_STATUS_CHANGED: { icon: 'clock', label: 'Status berubah', color: '#2563eb' },
  ORDER_COMPLETED: { icon: 'check', label: 'Pesanan diselesaikan', color: '#059669' },
  ORDER_CANCELLED: { icon: 'x', label: 'Pesanan dibatalkan', color: '#dc2626' },
  ORDER_CORRECTED: { icon: 'pencil', label: 'Pesanan dikoreksi', color: '#ea580c' },
  PAYMENT_UPDATED: { icon: 'card', label: 'Pembayaran diubah', color: '#7c3aed' },
  DAY_CLOSED: { icon: 'lock', label: 'Hari ditutup', color: '#374151' },
};

const ACTION_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  plus: PlusIcon,
  clock: ClockIcon,
  check: CheckCircleIcon,
  x: XCircleIcon,
  pencil: PencilIcon,
  card: CreditCardIcon,
  lock: LockIcon,
};

interface CorrectionItem {
  menuId: string;
  quantity: number;
  addonIds: string[];
  note: string;
}

function findProduct(
  products: MenuProduct[],
  id: string,
) {
  return products.find((p) => p.id === id);
}

export default function OrderDetailPage() {
  const orderId = useNavStore((s) => s.orderDetailId);
  const closeOrderDetail = useNavStore((s) => s.closeOrderDetail);
  const order = useOrderStore((s) =>
    s.orders.find((o) => o.id === orderId),
  );
  const auditLogs = useOrderStore((s) => s.auditLogs);
  const closedDays = useOrderStore((s) => s.closedDays);
  const changeStatus = useOrderStore((s) => s.changeStatus);
  const togglePayment = useOrderStore((s) => s.togglePayment);
  const correctOrder = useOrderStore((s) => s.correctOrder);
  const products = useMenuStore((s) => s.products);
  const addons = useMenuStore((s) => s.addons);
  const user = useAuthStore((s) => s.user);

  const [voidOpen, setVoidOpen] = useState(false);
  const [paymentReasonOpen, setPaymentReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionItems, setCorrectionItems] = useState<CorrectionItem[]>([]);
  const [correctionSource, setCorrectionSource] = useState<OrderSource>('grab');
  const [correctionExt, setCorrectionExt] = useState('');
  const [correctionCustomer, setCorrectionCustomer] = useState('');
  const [correctionPayment, setCorrectionPayment] =
    useState<PaymentStatus>('dibayar');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionError, setCorrectionError] = useState('');

  const isOwner = user?.role === 'owner';

  const orderLogs = useMemo(
    () =>
      auditLogs
        .filter((log) => log.orderId === orderId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [auditLogs, orderId],
  );

  const correctionTotals = useMemo(() => {
    let subtotal = 0;
    let addonsTotal = 0;
    for (const item of correctionItems) {
      const product = findProduct(products, item.menuId);
      if (!product) continue;
      subtotal += product.price * item.quantity;
      addonsTotal += item.addonIds
        .map((id) => addons.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .reduce((s, a) => s + a.price, 0);
    }
    return { subtotal, addonsTotal, total: subtotal + addonsTotal };
  }, [correctionItems, products, addons]);

  if (!order) {
    return (
      <div className="w-full px-4">
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="text-4xl">📄</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pesanan tidak ditemukan
          </p>
          <button
            onClick={closeOrderDetail}
            className="text-sm font-medium text-emerald-600 cursor-pointer bg-transparent border-0"
          >
            Kembali ke daftar pesanan
          </button>
        </div>
      </div>
    );
  }

  const isClosed = closedDays.includes(order.dayKey);
  const isFinal = order.status === 'selesai' || order.status === 'dibatalkan';
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  const handleVoid = async () => {
    if (!reason.trim()) {
      setReasonError('Alasan pembatalan wajib diisi');
      return;
    }
    setSubmitting(true);
    const res = changeStatus(order.id, 'dibatalkan', reason);
    if (!res.ok) {
      setReasonError(res.error ?? 'Gagal membatalkan');
      setSubmitting(false);
      return;
    }
    setVoidOpen(false);
    setReason('');
    setReasonError('');
    setSubmitting(false);
  };

  const handlePaymentToggle = async () => {
    setActionError('');
    if (isClosed) {
      setPaymentReasonOpen(true);
      return;
    }
    const res = togglePayment(order.id);
    if (!res.ok) setActionError(res.error ?? 'Gagal mengubah pembayaran');
  };

  const handlePaymentReason = async () => {
    if (!reason.trim()) {
      setReasonError('Alasan wajib diisi');
      return;
    }
    setSubmitting(true);
    const res = togglePayment(order.id, reason);
    if (!res.ok) {
      setReasonError(res.error ?? 'Gagal mengubah pembayaran');
      setSubmitting(false);
      return;
    }
    setPaymentReasonOpen(false);
    setReason('');
    setReasonError('');
    setSubmitting(false);
  };

  const openCorrection = () => {
    setCorrectionItems(
      order.items.map((i) => ({
        menuId: i.menuId,
        quantity: i.quantity,
        addonIds: i.addons.map((a) => a.id),
        note: i.note ?? '',
      })),
    );
    setCorrectionSource(order.source);
    setCorrectionExt(order.externalOrderNumber ?? '');
    setCorrectionCustomer(order.customerName ?? '');
    setCorrectionPayment(order.paymentStatus);
    setCorrectionNotes(order.notes ?? '');
    setCorrectionReason('');
    setCorrectionError('');
    setCorrectionOpen(true);
  };

  const saveCorrection = () => {
    if (!correctionReason.trim()) {
      setCorrectionError('Alasan koreksi wajib diisi');
      return;
    }
    const items: OrderItem[] = correctionItems
      .map((item) => {
        const product = findProduct(products, item.menuId);
        if (!product) return null;
        const itemAddons = item.addonIds
          .map((id) => addons.find((a) => a.id === id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map((a) => ({ id: a.id, name: a.name, price: a.price, quantity: 1 }));
        return {
          id: generateId(),
          menuId: product.id,
          menuName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          addons: itemAddons,
          note: item.note.trim() || undefined,
          subtotal:
            product.price * item.quantity +
            itemAddons.reduce((s, a) => s + a.price, 0),
        };
      })
      .filter((i): i is NonNullable<typeof i> => Boolean(i));

    if (items.length === 0) {
      setCorrectionError('Minimal 1 item');
      return;
    }

    const res = correctOrder(
      order.id,
      {
        source: correctionSource,
        externalOrderNumber: correctionExt,
        customerName: correctionCustomer,
        items,
        notes: correctionNotes,
        paymentStatus: correctionPayment,
      },
      correctionReason,
    );
    if (!res.ok) {
      setCorrectionError(res.error ?? 'Gagal menyimpan koreksi');
      return;
    }
    setCorrectionOpen(false);
  };

  return (
    <div className="w-full pb-[calc(84px+env(safe-area-inset-bottom))]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={closeOrderDetail}
          className="flex items-center gap-1 cursor-pointer bg-transparent border-0 text-gray-600 dark:text-gray-300"
        >
          <ArrowLeftIcon size={18} />
          <span className="text-sm font-medium">Kembali</span>
        </button>
        <h5 className="font-bold text-base dark:text-white">Detail Pesanan</h5>
        <div className="w-16" />
      </div>

      <div className="flex flex-col gap-3.5 px-4 pt-4">
        {isClosed && (
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg px-4 py-2.5 text-xs flex items-start gap-2">
            <LockIcon size={14} className="shrink-0 mt-0.5" />
            <span>
              Hari ini sudah ditutup ({order.dayKey}). Perubahan memerlukan alasan
              dan akan tercatat di audit.
            </span>
          </div>
        )}

        {/* Header card */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold dark:text-white">
                {order.orderNumber}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Dicatat {formatDateTime(order.createdAt)}
              </span>
              {order.externalOrderNumber && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Ref eksternal: {order.externalOrderNumber}
                </span>
              )}
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <PlatformBadge source={order.source} />
            <PaymentBadge status={order.paymentStatus} />
            {order.completedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircleIcon size={13} color="#059669" />
                Selesai {formatDateTime(order.completedAt)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal</p>
              <p className="font-semibold text-sm dark:text-gray-100">
                {formatCurrency(order.subtotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add-on</p>
              <p className="font-semibold text-sm dark:text-gray-100">
                {formatCurrency(order.addonsTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {formatCurrency(order.total)}
              </p>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <p className="font-semibold text-sm mb-2 dark:text-gray-100">
            Item ({itemCount})
          </p>
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium dark:text-gray-100">
                    {item.quantity}× {item.menuName}
                  </span>
                  <span className="text-sm font-semibold dark:text-gray-100">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                </div>
                {item.addons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.addons.map((a) => (
                      <span
                        key={a.id}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                      >
                        +{a.name} ({formatCurrency(a.price)})
                      </span>
                    ))}
                  </div>
                )}
                {item.note && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Catatan: {item.note}
                  </span>
                )}
              </div>
            ))}
          </div>
          {order.customerName && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
              Pelanggan: <span className="font-medium">{order.customerName}</span>
            </div>
          )}
          {order.notes && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Catatan pesanan: {order.notes}
            </div>
          )}
        </section>

        {/* Actions */}
        {actionError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-2.5 text-sm">
            {actionError}
          </div>
        )}
        {!isFinal && (
          <section className="flex flex-col gap-2">
            {order.status === 'baru' && (
              <button
                onClick={() => changeStatus(order.id, 'diproses')}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity border-0"
              >
                Mulai Proses
              </button>
            )}
            <button
              onClick={() => changeStatus(order.id, 'selesai')}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity border-0"
            >
              Tandai Selesai
            </button>
            <button
              onClick={() => setVoidOpen(true)}
              className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold text-sm cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border-0"
            >
              Batalkan Pesanan
            </button>
          </section>
        )}

        {isFinal && (
          <section className="flex flex-col gap-2">
            <button
              onClick={handlePaymentToggle}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-semibold text-sm cursor-pointer border-0"
            >
              <CreditCardIcon size={16} />
              Tandai {order.paymentStatus === 'dibayar' ? 'Belum Dibayar' : 'Dibayar'}
            </button>
            {isOwner && (
              <button
                onClick={openCorrection}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 font-semibold text-sm cursor-pointer border-0"
              >
                <RotateCcwIcon size={16} />
                Koreksi Pesanan
              </button>
            )}
            {order.status === 'dibatalkan' && (
              <p className="text-xs text-center text-red-500 dark:text-red-400">
                Pesanan ini dibatalkan dan bersifat final.
              </p>
            )}
          </section>
        )}

        {/* Audit log */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <HistoryIcon size={16} color="#6b7280" />
            <p className="font-semibold text-sm dark:text-gray-100">
              Riwayat Audit
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {orderLogs.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Belum ada aktivitas tercatat.
              </p>
            )}
            {orderLogs.map((log) => {
              const meta = ACTION_META[log.actionType];
              const Icon = ACTION_ICON[meta.icon] ?? ClockIcon;
              return (
                <div
                  key={log.id}
                  className="flex gap-3 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Icon size={15} color={meta.color} />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium dark:text-gray-100">
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      oleh {log.userName}
                    </span>
                    {log.reason && (
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        Alasan: {log.reason}
                      </span>
                    )}
                    {log.actionType === 'ORDER_STATUS_CHANGED' && (
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {String(log.oldValue)} → {String(log.newValue)}
                      </span>
                    )}
                    {log.actionType === 'PAYMENT_UPDATED' && (
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {String(log.oldValue)} → {String(log.newValue)}
                      </span>
                    )}
                    {log.actionType === 'ORDER_CORRECTED' &&
                      typeof log.oldValue === 'object' &&
                      log.oldValue !== null &&
                      'total' in log.oldValue &&
                      typeof log.newValue === 'object' &&
                      log.newValue !== null &&
                      'total' in log.newValue && (
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Total:{' '}
                          {formatCurrency(Number((log.oldValue as { total: number }).total))}{' '}
                          →{' '}
                          {formatCurrency(Number((log.newValue as { total: number }).total))}
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Void modal */}
      <Modal
        opened={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Batalkan Pesanan"
        centered
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Batalkan <b>{order.orderNumber}</b>? Pembatalan tercatat permanen di
            riwayat audit dan tidak dapat dihapus.
          </p>
          <Textarea
            placeholder="Alasan pembatalan (wajib)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            minRows={3}
          />
          {reasonError && (
            <span className="text-xs text-red-600">{reasonError}</span>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setVoidOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer bg-transparent"
            >
              Batal
            </button>
            <button
              disabled={submitting}
              onClick={handleVoid}
              className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-60"
            >
              Konfirmasi Pembatalan
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment reason modal (closed day) */}
      <Modal
        opened={paymentReasonOpen}
        onClose={() => setPaymentReasonOpen(false)}
        title="Ubah Status Pembayaran"
        centered
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Hari sudah ditutup. Perubahan pembayaran memerlukan alasan.
          </p>
          <Textarea
            placeholder="Alasan perubahan (wajib)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            minRows={3}
          />
          {reasonError && (
            <span className="text-xs text-red-600">{reasonError}</span>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentReasonOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer bg-transparent"
            >
              Batal
            </button>
            <button
              disabled={submitting}
              onClick={handlePaymentReason}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-60"
            >
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Correction modal */}
      <Modal
        opened={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        title="Koreksi Pesanan"
        centered
        size="lg"
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Koreksi tercatat permanen di audit (nilai lama → baru) beserta
            alasan. Nomor pesanan &amp; waktu pencatatan tidak dapat diubah.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Sumber
              </label>
              <select
                value={correctionSource}
                onChange={(e) =>
                  setCorrectionSource(e.target.value as OrderSource)
                }
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
              >
                <option value="grab">GrabFood</option>
                <option value="gofood">GoFood</option>
                <option value="shopeefood">ShopeeFood</option>
                <option value="manual">Manual / Lainnya</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Ref eksternal
              </label>
              <input
                type="text"
                value={correctionExt}
                onChange={(e) => setCorrectionExt(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Nama pelanggan
            </label>
            <input
              type="text"
              value={correctionCustomer}
              onChange={(e) => setCorrectionCustomer(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Item ({correctionItems.reduce((s, i) => s + i.quantity, 0)})
            </p>
            {correctionItems.map((item, index) => {
              const product = findProduct(products, item.menuId);
              if (!product) return null;
              const productAddons = addons.filter((a) =>
                product.addonIds.includes(a.id),
              );
              const itemAddonsTotal = item.addonIds
                .map((id) => addons.find((a) => a.id === id))
                .filter((a): a is NonNullable<typeof a> => Boolean(a))
                .reduce((s, a) => s + a.price, 0);
              const subtotal = item.quantity * product.price + itemAddonsTotal;
              return (
                <div
                  key={item.menuId}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium dark:text-gray-100 truncate">
                      {product.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...correctionItems];
                          next[index] = {
                            ...next[index],
                            quantity: Math.max(
                              1,
                              next[index].quantity - 1,
                            ),
                          };
                          setCorrectionItems(next);
                        }}
                        className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer border-0"
                      >
                        <MinusIcon size={15} color="#4b5563" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm dark:text-gray-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...correctionItems];
                          next[index] = {
                            ...next[index],
                            quantity: next[index].quantity + 1,
                          };
                          setCorrectionItems(next);
                        }}
                        className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center cursor-pointer border-0"
                      >
                        <PlusIcon size={15} color="white" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCorrectionItems((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center cursor-pointer border-0 ml-1"
                      >
                        <TrashIcon size={15} color="#dc2626" />
                      </button>
                    </div>
                  </div>
                  {productAddons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {productAddons.map((addon) => {
                        const checked = item.addonIds.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => {
                              const next = [...correctionItems];
                              const has = next[index].addonIds.includes(
                                addon.id,
                              );
                              next[index] = {
                                ...next[index],
                                addonIds: has
                                  ? next[index].addonIds.filter(
                                      (a) => a !== addon.id,
                                    )
                                  : [...next[index].addonIds, addon.id],
                              };
                              setCorrectionItems(next);
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer ${
                              checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            +{addon.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => {
                        const next = [...correctionItems];
                        next[index] = { ...next[index], note: e.target.value };
                        setCorrectionItems(next);
                      }}
                      placeholder="Catatan item"
                      className="flex-1 py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 outline-none"
                    />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
            {correctionItems.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tidak ada item. Tambahkan setidaknya 1 item.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Catatan pesanan
            </label>
            <textarea
              rows={2}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Pembayaran
            </label>
            <div className="flex gap-2">
              {(['dibayar', 'belum_dibayar'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setCorrectionPayment(status)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    correctionPayment === status
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {status === 'dibayar' ? 'Dibayar' : 'Belum Dibayar'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Total koreksi
            </span>
            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
              {formatCurrency(correctionTotals.total)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Alasan koreksi (wajib)
            </label>
            <Textarea
              placeholder="Jelaskan alasan koreksi"
              value={correctionReason}
              onChange={(e) => {
                setCorrectionReason(e.target.value);
                setCorrectionError('');
              }}
              minRows={3}
            />
            {correctionError && (
              <span className="text-xs text-red-600">{correctionError}</span>
            )}
          </div>

          <button
            onClick={saveCorrection}
            className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity border-0"
          >
            Simpan Koreksi
          </button>
        </div>
      </Modal>
    </div>
  );
}
