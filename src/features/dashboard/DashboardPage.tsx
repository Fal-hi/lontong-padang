import { useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import {
  PageContainer,
  StatCard,
  SectionTitle,
  QuickActionButton,
  PlatformBadge,
  StatusBadge,
  PaymentBadge,
} from "../../components";
import { useOrderStore, useDaySummary } from "../../stores/orderStore";
import { useNavStore } from "../../stores/navStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoreStore } from "../../stores/storeStore";
import {
  addDays,
  computeDaySummary,
  formatCompact,
  formatCurrency,
  formatTime,
  getGreeting,
  todayKey,
  toDayKey,
  todayLabel,
} from "../../utils";
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  ORDER_SOURCES,
} from "../../constants";
import { AreaChart } from "@mantine/charts";
import { useMediaQuery } from "@mantine/hooks";
import { LockIcon, LockOpenIcon } from "../../utils/icons";

export default function DashboardPage() {
  const navigate = useNavStore((s) => s.navigate);
  const openOrderDetail = useNavStore((s) => s.openOrderDetail);
  const allOrders = useOrderStore((s) => s.orders);
  const closeDay = useOrderStore((s) => s.closeDay);
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [closeDone, setCloseDone] = useState(false);

  const today = todayLabel();
  const todayDayKey = todayKey();
  const { orders: todayOrders, isClosed } = useDaySummary(todayDayKey);
  const todaySummary = useMemo(
    () => computeDaySummary(todayOrders),
    [todayOrders],
  );

  const isOwner = user?.role === "owner";

  const popularItems = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    for (const order of todayOrders) {
      if (order.status === "dibatalkan") continue;
      for (const item of order.items) {
        const cur = map.get(item.menuId);
        if (cur) cur.quantity += item.quantity;
        else
          map.set(item.menuId, {
            name: item.menuName,
            quantity: item.quantity,
          });
      }
    }
    return [...map.entries()]
      .map(([menuId, v]) => ({ menuId, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [todayOrders]);

  const recentOrders = useMemo(
    () =>
      [...todayOrders]
        .sort(
          (a, b) =>
            new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
        )
        .slice(0, 5),
    [todayOrders],
  );

  console.log({ recentOrders });

  const weekSeries = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayKey = toDayKey(addDays(new Date(), i - 6));
      const summary = computeDaySummary(
        allOrders.filter((o) => o.dayKey === dayKey),
      );
      return {
        date: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(
          new Date(`${dayKey}T00:00:00`),
        ),
        penjualan: summary.grossSales,
        pesanan: summary.totalOrders,
      };
    });
    return days;
  }, [allOrders]);

  const isMobile = useMediaQuery("(max-width: 640px)");

  const handleCloseDay = () => {
    setCloseError("");
    const res = closeDay(todayDayKey);
    if (!res.ok) {
      setCloseError(res.error ?? "Gagal menutup hari");
      return;
    }
    setCloseDone(true);
  };

  const firstName = user?.fullName?.split(" ")[0] ?? "Pengguna";

  return (
    <PageContainer>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h5 className="font-bold text-lg leading-tight dark:text-white truncate">
              {getGreeting()}, {firstName}
            </h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {store.name} · Ringkasan hari ini
            </p>
          </div>
          {isClosed ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
              <LockIcon size={12} /> Hari ditutup
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <LockOpenIcon size={12} /> Hari berjalan
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Pendapatan Hari Ini"
            value={todaySummary.grossSales}
            icon="dollar"
            isPrice
          />
          <StatCard
            label="Pesanan"
            value={todaySummary.totalOrders}
            icon="orders"
          />
          <StatCard
            label="Selesai"
            value={todaySummary.completedCount}
            icon="check"
          />
          <StatCard
            label="Dibatalkan"
            value={todaySummary.cancelledCount}
            icon="cancel"
          />
          <StatCard
            label="Belum Dibayar"
            value={todaySummary.unpaidCount}
            icon="wallet"
          />
          <StatCard
            label="Rata-rata Pesanan"
            value={todaySummary.avgOrderValue}
            icon="trending"
            isPrice
          />
        </div>

        <div>
          <SectionTitle title="Aksi Cepat" />
          <div className="grid grid-cols-4 gap-2">
            <QuickActionButton
              label="Pesanan Baru"
              icon="plus"
              color="green"
              action="new-order"
            />
            <QuickActionButton
              label="Pesanan"
              icon="orders"
              color="gray"
              page="orders"
            />
            <QuickActionButton
              label="Laporan"
              icon="reports"
              color="gray"
              page="reports"
            />
            <QuickActionButton
              label="Menu"
              icon="menu"
              color="gray"
              page="menu"
            />
          </div>
        </div>

        <div>
          <SectionTitle title="Penjualan per Platform" />
          <div className="grid grid-cols-2 gap-2.5">
            {ORDER_SOURCES.map((source) => {
              const data = todaySummary.byPlatform[source.value];
              return (
                <div
                  key={source.value}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <PlatformBadge source={source.value} showLabel={false} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {data.orders} pesanan
                    </span>
                  </div>
                  <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                    {formatCompact(data.sales)}
                  </span>
                  {data.cancelled > 0 && (
                    <span className="text-[11px] text-red-500 dark:text-red-400">
                      {data.cancelled} dibatalkan
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle title="Ringkasan Penjualan (7 Hari)" />
          <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <AreaChart
              h={isMobile ? 170 : 240}
              data={weekSeries}
              dataKey="date"
              series={[
                {
                  name: "penjualan",
                  color: CHART_COLORS.revenue,
                  label: "Pendapatan",
                },
              ]}
              tickLine="y"
              gridAxis="x"
              withTooltip
              tooltipProps={{
                contentStyle: CHART_TOOLTIP_STYLE,
              }}
              xAxisProps={{
                tickMargin: 8,
                tick: { fontSize: isMobile ? 10 : 12 },
              }}
              yAxisProps={{
                tickFormatter: (v: number) => `${(v / 1_000_000).toFixed(0)}jt`,
                tick: { fontSize: isMobile ? 10 : 12 },
                width: isMobile ? 36 : 60,
              }}
              valueFormatter={(v) => formatCompact(Number(v))}
            />
          </div>
        </div>

        <div>
          <SectionTitle
            title="Pesanan Terbaru"
            actionLabel="Lihat Semua"
            onAction={() => navigate("orders")}
          />
          <div className="flex flex-col gap-2">
            {recentOrders.length === 0 && (
              <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
                Belum ada pesanan hari ini.
              </div>
            )}
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => openOrderDetail(order.id)}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm dark:text-gray-100 truncate">
                        {order.orderNumber}
                      </span>
                      <PlatformBadge
                        source={order.source}
                        showLabel={false}
                        iconSize={13}
                      />
                    </div>
                    <span className="text-xs text-black dark:text-gray-400 mt-0">
                      {order.source}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                    {formatCurrency(order.total)}
                  </span>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
                    {order.customerName ?? "Walk-in"} ·{" "}
                    {order.items.reduce((s, i) => s + i.quantity, 0)} item · {formatTime(order.orderDate)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={order.status} size="sm" />
                    <PaymentBadge status={order.paymentStatus} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle title="Penjualan Terlaris Hari Ini" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
              {popularItems.length === 0 && (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Belum ada penjualan hari ini.
                </p>
              )}
              {popularItems.map((item, i) => (
                <div
                  key={item.menuId}
                  className="flex items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium dark:text-gray-100 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                    {item.quantity} terjual
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tutup Hari */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm dark:text-gray-100">
                  Penutupan Hari
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isClosed
                    ? "Hari ini sudah ditutup. Transaksi selesai bersifat read-only."
                    : `Rangkuman hari ini ${today} sebelum ditutup.`}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Gross
                </p>
                <p className="font-semibold dark:text-gray-100">
                  {formatCurrency(todaySummary.grossSales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selesai
                </p>
                <p className="font-semibold dark:text-gray-100">
                  {formatCurrency(todaySummary.completedSales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dibatalkan
                </p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(todaySummary.cancelledAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Belum dibayar
                </p>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(todaySummary.unpaidAmount)}
                </p>
              </div>
            </div>
            {!isClosed && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                    <p className="text-xs font-medium text-gray-500">Total</p>
                    <p className="mt-1 text-xl font-bold leading-none text-gray-900">
                      {todaySummary.totalOrders}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400">pesanan</p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <p className="text-xs font-medium text-emerald-700">
                      Selesai
                    </p>
                    <p className="mt-1 text-xl font-bold leading-none text-emerald-700">
                      {todaySummary.completedCount}
                    </p>
                    <p className="mt-1 text-[10px] text-emerald-600">pesanan</p>
                  </div>

                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3">
                    <p className="text-xs font-medium text-red-600">
                      Dibatalkan
                    </p>
                    <p className="mt-1 text-xl font-bold leading-none text-red-600">
                      {todaySummary.cancelledCount}
                    </p>
                    <p className="mt-1 text-[10px] text-red-500">pesanan</p>
                  </div>
                </div>

                {/* Status penyelesaian */}
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Status pesanan
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">
                        {todaySummary.completedCount} dari{" "}
                        {todaySummary.totalOrders} pesanan selesai
                      </p>
                    </div>

                    <span className="text-sm font-bold text-emerald-600">
                      {todaySummary.totalOrders > 0
                        ? Math.round(
                            (todaySummary.completedCount /
                              todaySummary.totalOrders) *
                              100,
                          )
                        : 0}
                      %
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${
                          todaySummary.totalOrders > 0
                            ? Math.min(
                                100,
                                (todaySummary.completedCount /
                                  todaySummary.totalOrders) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            {isOwner && (
              <button
                onClick={() => {
                  setCloseError("");
                  setCloseDone(false);
                  setCloseOpen(true);
                }}
                className="mt-6 py-2 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0"
              >
                Tutup Hari
              </button>
            )}
          </div>
        </div>
      </section>

      <Modal
        opened={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Tutup Hari Ini?"
        centered
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Setelah ditutup, transaksi selesai hari ini bersifat permanen
            (read-only). Koreksi tetap dimungkinkan dengan alasan dan tercatat
            di audit. Pastikan semua pesanan berstatus Selesai/Dibatalkan.
          </p>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-sm flex flex-col gap-1">
            <span className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-300">Gross</span>
              <span className="font-semibold dark:text-gray-100">
                {formatCurrency(todaySummary.grossSales)}
              </span>
            </span>
            <span className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-300">Selesai</span>
              <span className="font-semibold dark:text-gray-100">
                {todaySummary.completedCount} pesanan ·{" "}
                {formatCurrency(todaySummary.completedSales)}
              </span>
            </span>
            <span className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-300">
                Dibatalkan
              </span>
              <span className="font-semibold dark:text-gray-100">
                {todaySummary.cancelledCount} pesanan
              </span>
            </span>
          </div>
          {closeError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {closeError}
            </span>
          )}
          {closeDone && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Hari berhasil ditutup. Transaksi hari ini terkunci.
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setCloseOpen(false)}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer bg-transparent"
            >
              Batal
            </button>
            <button
              onClick={handleCloseDay}
              disabled={closeDone}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-60"
            >
              Konfirmasi Tutup
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
