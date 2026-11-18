import { useMemo, useState } from 'react';
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
import type { OrderSource, OrderStatus, PaymentStatus } from '../../types';
import {
  addDays,
  computeDaySummary,
  toDayKey,
  todayKey,
} from '../../utils';
import { PlusIcon } from '../../utils/icons';

type DateFilter = 'today' | 'yesterday' | 'week' | 'all';
type SourceFilter = OrderSource | 'all';

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

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentStatus | 'all'>('all');

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
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {openCount} aktif
            </span>
          )}
        </div>

        {/* Quick summary strip */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center">
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Total Hari Ini</span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{todaySummary.totalOrders}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Selesai</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{todaySummary.completedCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Belum Bayar</span>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{todaySummary.unpaidCount}</span>
          </div>
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari no. pesanan, pelanggan..."
        />

        {/* Date filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          {DATE_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              active={dateFilter === f.key}
              label={f.label}
              onClick={() => setDateFilter(f.key)}
            />
          ))}
        </div>

        {/* Platform filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          <FilterChip
            active={sourceFilter === 'all'}
            label="Semua Platform"
            onClick={() => setSourceFilter('all')}
          />
          {ORDER_SOURCES.map((source) => (
            <FilterChip
              key={source.value}
              active={sourceFilter === source.value}
              label={source.label}
              onClick={() => setSourceFilter(source.value)}
            />
          ))}
        </div>

        {/* Status + payment filters */}
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-0.5 hide-scrollbar">
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={statusFilter === opt.value}
              label={opt.label}
              onClick={() => setStatusFilter(opt.value as OrderStatus | 'all')}
            />
          ))}
          <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={paymentFilter === opt.value}
              label={opt.label}
              onClick={() =>
                setPaymentFilter(opt.value as PaymentStatus | 'all')
              }
            />
          ))}
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filteredOrders.length} pesanan
        </span>

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
          className="pointer-events-auto w-12 h-12 rounded-full bg-emerald-600 shadow-lg flex items-center justify-center cursor-pointer border-0 active:scale-95 text-white"
          aria-label="Buat pesanan baru"
        >
          <PlusIcon size={22} color="white" />
        </button>
      </div>
    </PageContainer>
  );
}
