import { useMemo } from 'react';
import {
  PageContainer,
  SectionTitle,
  SearchBar,
  OrderCard,
  FilterChip,
} from '../../components';
import { useOrderStore, useDaySummary } from '../../stores/orderStore';
import { useNavStore } from '../../stores/navStore';
import {
  ORDER_SOURCES,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../../constants';
import type {
  DateFilter,
  OrderStatus,
  PaymentStatus,
} from '../../types';
import {
  addDays,
  computeDaySummary,
  toDayKey,
  todayKey,
} from '../../utils';
import { PlusIcon } from '../../utils/icons';

const DATE_FILTERS: Array<{ key: DateFilter; label: string }> = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'all', label: 'Semua' },
];

function weekStartKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return toDayKey(addDays(now, -diff));
}

export default function OrdersPage() {
  const orders = useOrderStore((s) => s.orders);
  const openOrderDetail = useNavStore((s) => s.openOrderDetail);
  const openNewOrder = useNavStore((s) => s.openNewOrder);
  const orderFilters = useNavStore((s) => s.orderFilters);
  const setOrderFilter = useNavStore((s) => s.setOrderFilter);
  const navigateWithOrderFilter = useNavStore((s) => s.navigateWithOrderFilter);
  const resetOrderFilters = useNavStore((s) => s.resetOrderFilters);

  const {
    search,
    date: dateFilter,
    source: sourceFilter,
    status: statusFilter,
    payment: paymentFilter,
  } = orderFilters;

  const today = todayKey();
  const { orders: todayOrders } = useDaySummary(today);
  const todaySummary = useMemo(() => computeDaySummary(todayOrders), [todayOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wStart = weekStartKey();
    return orders.filter((o) => {
      if (dateFilter === 'today' && o.dayKey !== today) return false;
      if (dateFilter === 'yesterday' && o.dayKey !== toDayKey(addDays(new Date(), -1)))
        return false;
      if (dateFilter === 'week' && o.dayKey < wStart) return false;
      if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter)
        return false;
      if (q) {
        const haystack = [
          o.orderNumber,
          o.externalOrderNumber ?? '',
          o.customerName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, dateFilter, sourceFilter, statusFilter, paymentFilter, today]);

  const openCount = todayOrders.filter(
    (o) => o.status === 'baru' || o.status === 'diproses',
  ).length;

  return (
    <PageContainer>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle title="Pesanan" />
          {openCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
              {openCount} aktif
            </span>
          )}
        </div>

        {/* Quick summary strip with interactive filter shortcuts (Total, Selesai, Dibatalkan, Belum Bayar) */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => {
              navigateWithOrderFilter({
                date: 'today',
                status: 'all',
                payment: 'all',
              });
            }}
            className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-200 active:scale-95 ${
              dateFilter === 'today' &&
              statusFilter === 'all' &&
              paymentFilter === 'all'
                ? 'bg-info-50/80 border-info-400 dark:bg-info-950/40 dark:border-info-600 shadow-xs'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400'
            }`}
          >
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
              Total
            </span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
              {todaySummary.totalOrders}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigateWithOrderFilter({
                date: 'today',
                payment: 'all',
                status: statusFilter === 'selesai' ? 'all' : 'selesai',
              });
            }}
            className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-200 active:scale-95 ${
              statusFilter === 'selesai'
                ? 'bg-primary-50/80 border-primary-400 dark:bg-primary-950/50 dark:border-primary-600 shadow-xs ring-1 ring-primary-400'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300'
            }`}
          >
            <span className="text-[10px] text-primary-700 dark:text-primary-400 block font-medium truncate">
              Selesai
            </span>
            <span className="text-xs font-bold text-primary dark:text-primary-400">
              {todaySummary.completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigateWithOrderFilter({
                date: 'today',
                payment: 'all',
                status: statusFilter === 'dibatalkan' ? 'all' : 'dibatalkan',
              });
            }}
            className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-200 active:scale-95 ${
              statusFilter === 'dibatalkan'
                ? 'bg-danger-50/80 border-danger-400 dark:bg-danger-950/50 dark:border-danger-600 shadow-xs ring-1 ring-danger-400'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-danger-300'
            }`}
          >
            <span className="text-[10px] text-danger-700 dark:text-danger-400 block font-medium truncate">
              Batal
            </span>
            <span className="text-xs font-bold text-danger dark:text-danger-400">
              {todaySummary.cancelledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigateWithOrderFilter({
                date: 'today',
                status: 'all',
                payment:
                  paymentFilter === 'belum_dibayar' ? 'all' : 'belum_dibayar',
              });
            }}
            className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-200 active:scale-95 ${
              paymentFilter === 'belum_dibayar'
                ? 'bg-warning-50/80 border-warning-400 dark:bg-warning-950/50 dark:border-warning-600 shadow-xs ring-1 ring-warning-400'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-warning-300'
            }`}
          >
            <span className="text-[10px] text-warning-700 dark:text-warning-400 block font-medium truncate">
              Belum Bayar
            </span>
            <span className="text-xs font-bold text-warning-600 dark:text-warning-400">
              {todaySummary.unpaidCount}
            </span>
          </button>
        </div>

        <SearchBar
          value={search}
          onChange={(val) => setOrderFilter('search', val)}
          placeholder="Cari no. pesanan, pelanggan..."
        />

        {/* Date filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          {DATE_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              active={dateFilter === f.key}
              label={f.label}
              onClick={() => setOrderFilter('date', f.key)}
            />
          ))}
        </div>

        {/* Platform filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          <FilterChip
            active={sourceFilter === 'all'}
            label="Semua Platform"
            onClick={() => setOrderFilter('source', 'all')}
          />
          {ORDER_SOURCES.map((source) => (
            <FilterChip
              key={source.value}
              active={sourceFilter === source.value}
              label={source.label}
              onClick={() => setOrderFilter('source', source.value)}
            />
          ))}
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={statusFilter === opt.value}
              label={opt.label}
              onClick={() =>
                setOrderFilter('status', opt.value as OrderStatus | 'all')
              }
            />
          ))}
        </div>

        {/* Payment filters - Diletakkan di bawah baris status agar terlihat jelas tanpa scroll samping */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={paymentFilter === opt.value}
              label={opt.label}
              onClick={() =>
                setOrderFilter('payment', opt.value as PaymentStatus | 'all')
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {filteredOrders.length} pesanan
            {paymentFilter === 'belum_dibayar' && (
              <span className="ml-1.5 font-semibold text-warning-600 dark:text-warning-400">
                (Belum Dibayar)
              </span>
            )}
            {statusFilter === 'selesai' && (
              <span className="ml-1.5 font-semibold text-primary-600 dark:text-primary-400">
                (Selesai)
              </span>
            )}
            {statusFilter === 'dibatalkan' && (
              <span className="ml-1.5 font-semibold text-danger-600 dark:text-danger-400">
                (Dibatalkan)
              </span>
            )}
          </span>
          {(statusFilter !== 'all' ||
            paymentFilter !== 'all' ||
            sourceFilter !== 'all' ||
            dateFilter !== 'today' ||
            search) && (
            <button
              type="button"
              onClick={resetOrderFilters}
              className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline font-medium cursor-pointer bg-transparent border-0"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Order cards list */}
        <div className="flex flex-col gap-2.5">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => openOrderDetail(order.id)}
            />
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">📋</span>
              <span className="font-medium text-sm text-gray-500 dark:text-gray-400">
                Tidak ada pesanan ditemukan
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Coba ubah filter atau buat pesanan baru
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 max-w-md mx-auto pointer-events-none z-40 px-4 flex justify-end">
        <button
          type="button"
          onClick={openNewOrder}
          className="pointer-events-auto w-12 h-12 rounded-full bg-gradient-to-r from-primary to-teal-600 shadow-lg shadow-primary/30 flex items-center justify-center cursor-pointer border-0 active:scale-90 hover:brightness-105 transition-all text-white"
          aria-label="Buat pesanan baru"
        >
          <PlusIcon size={22} color="white" />
        </button>
      </div>
    </PageContainer>
  );
}
