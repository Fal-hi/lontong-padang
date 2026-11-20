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
  FilterChip,
  ChartCustomTooltip,
} from "../../components";
import { useOrderStore, useDaySummary } from "../../stores/orderStore";
import { useNavStore } from "../../stores/navStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoreStore } from "../../stores/storeStore";
import { notify } from "../../stores/notificationStore";
import type { OrderStatus, PaymentStatus } from "../../types";
import {
  addDays,
  computeDaySummary,
  formatChartYAxis,
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
  ORDER_SOURCES,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "../../constants";
import { AreaChart } from "@mantine/charts";
import { useMediaQuery } from "@mantine/hooks";
import {
  LockIcon,
  LockOpenIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
} from "../../utils/icons";

const platformCardStyles: Record<
  string,
  {
    bg: string;
    border: string;
    hoverBorder: string;
    arrowColor: string;
    salesColor: string;
  }
> = {
  grab: {
    bg: 'bg-gradient-to-br from-primary-50/70 via-white to-primary-50/20 dark:from-primary-950/30 dark:via-gray-800 dark:to-primary-950/10',
    border: 'border-primary-200/80 dark:border-primary-800/60',
    hoverBorder: 'hover:border-primary-400 hover:shadow-primary-500/10',
    arrowColor: '#059669',
    salesColor: 'text-primary-700 dark:text-primary-400',
  },
  gofood: {
    bg: 'bg-gradient-to-br from-danger-50/70 via-white to-danger-50/20 dark:from-danger-950/30 dark:via-gray-800 dark:to-danger-950/10',
    border: 'border-danger-200/80 dark:border-danger-800/60',
    hoverBorder: 'hover:border-danger-400 hover:shadow-danger-500/10',
    arrowColor: '#dc2626',
    salesColor: 'text-danger-700 dark:text-danger-400',
  },
  shopeefood: {
    bg: 'bg-gradient-to-br from-warning-50/70 via-white to-warning-50/20 dark:from-warning-950/30 dark:via-gray-800 dark:to-warning-950/10',
    border: 'border-warning-200/80 dark:border-warning-800/60',
    hoverBorder: 'hover:border-warning-400 hover:shadow-warning-500/10',
    arrowColor: '#ea580c',
    salesColor: 'text-warning-700 dark:text-warning-400',
  },
  manual: {
    bg: 'bg-gradient-to-br from-info-50/70 via-white to-info-50/20 dark:from-info-950/30 dark:via-gray-800 dark:to-info-950/10',
    border: 'border-info-200/80 dark:border-info-800/60',
    hoverBorder: 'hover:border-info-400 hover:shadow-info-500/10',
    arrowColor: '#2563eb',
    salesColor: 'text-info-700 dark:text-info-400',
  },
};

const statusBorderClass: Record<string, string> = {
  selesai: 'border-l-primary-500',
  diproses: 'border-l-info-500',
  baru: 'border-l-warning-500',
  dibatalkan: 'border-l-danger-500',
};

export default function DashboardPage() {
  const navigate = useNavStore((s) => s.navigate);
  const navigateWithOrderFilter = useNavStore((s) => s.navigateWithOrderFilter);
  const openOrderDetail = useNavStore((s) => s.openOrderDetail);
  const allOrders = useOrderStore((s) => s.orders);
  const closeDay = useOrderStore((s) => s.closeDay);
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [closeDone, setCloseDone] = useState(false);
  const [dashStatusFilter, setDashStatusFilter] = useState<OrderStatus | "all">("all");
  const [dashPaymentFilter, setDashPaymentFilter] = useState<PaymentStatus | "all">("all");

  const today = todayLabel();
  const todayDayKey = todayKey();
  const { orders: todayOrders, isClosed } = useDaySummary(todayDayKey);
  const todaySummary = useMemo(
    () => computeDaySummary(todayOrders),
    [todayOrders],
  );

  const isOwner = user?.role === "owner" || user?.role === "super_admin";

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

  const filteredDashboardOrders = useMemo(() => {
    return todayOrders
      .filter((o) => {
        if (dashStatusFilter !== "all" && o.status !== dashStatusFilter)
          return false;
        if (
          dashPaymentFilter !== "all" &&
          o.paymentStatus !== dashPaymentFilter
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
      );
  }, [todayOrders, dashStatusFilter, dashPaymentFilter]);

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
      notify.error(res.error ?? "Gagal menutup hari", "Tutup Hari Gagal");
      return;
    }
    setCloseDone(true);
    notify.success("Hari transaksi berhasil ditutup. Laporan tersimpan dan transaksi terkunci.", "Tutup Hari Berhasil");
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
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              <LockOpenIcon size={12} /> Hari berjalan
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Pendapatan Hari Ini"
            value={todaySummary.grossSales}
            icon="dollar"
            color="primary"
            isPrice
            onClick={() => navigate("reports")}
          />
          <StatCard
            label="Pesanan"
            value={todaySummary.totalOrders}
            icon="orders"
            color="blue"
            onClick={() =>
              navigateWithOrderFilter({
                status: "all",
                payment: "all",
                date: "today",
              })
            }
          />
          <StatCard
            label="Selesai"
            value={todaySummary.completedCount}
            icon="check"
            color="teal"
            onClick={() =>
              navigateWithOrderFilter({
                status: "selesai",
                payment: "all",
                date: "today",
              })
            }
          />
          <StatCard
            label="Dibatalkan"
            value={todaySummary.cancelledCount}
            icon="cancel"
            color="red"
            onClick={() =>
              navigateWithOrderFilter({
                status: "dibatalkan",
                payment: "all",
                date: "today",
              })
            }
          />
          <StatCard
            label="Belum Dibayar"
            value={todaySummary.unpaidCount}
            icon="wallet"
            color="amber"
            onClick={() =>
              navigateWithOrderFilter({
                payment: "belum_dibayar",
                status: "all",
                date: "today",
              })
            }
          />
          <StatCard
            label="Rata-rata Pesanan"
            value={todaySummary.avgOrderValue}
            icon="trending"
            color="purple"
            isPrice
            onClick={() => navigate("reports")}
          />
        </div>

        <div>
          <SectionTitle title="Aksi Cepat" />
          <div className="grid grid-cols-4 gap-2">
            <QuickActionButton
              label="Pesanan Baru"
              icon="plus"
              color="primary"
              action="new-order"
            />
            <QuickActionButton
              label="Pesanan"
              icon="orders"
              color="blue"
              page="orders"
            />
            <QuickActionButton
              label="Laporan"
              icon="reports"
              color="purple"
              page="reports"
            />
            <QuickActionButton
              label="Menu"
              icon="menu"
              color="orange"
              page="menu"
            />
          </div>
        </div>

        <div>
          <SectionTitle title="Penjualan per Platform" />
          <div className="grid grid-cols-2 gap-2.5">
            {ORDER_SOURCES.map((source) => {
              const data = todaySummary.byPlatform[source.value];
              const pStyle =
                platformCardStyles[source.value] ?? platformCardStyles.manual;
              return (
                <button
                  type="button"
                  key={source.value}
                  onClick={() =>
                    navigateWithOrderFilter({
                      source: source.value,
                      date: "today",
                    })
                  }
                  title={`Lihat pesanan ${source.label}`}
                  className={`group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-200 hover:shadow-md active:scale-97 flex flex-col gap-1.5 ${pStyle.bg} ${pStyle.border} ${pStyle.hoverBorder}`}
                >
                  <div className="absolute top-2 right-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRightIcon size={12} color={pStyle.arrowColor} />
                  </div>
                  <div className="flex items-center justify-between pr-4">
                    <PlatformBadge source={source.value} showLabel={false} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {data.orders} pesanan
                    </span>
                  </div>
                  <span className={`font-bold text-sm ${pStyle.salesColor}`}>
                    {formatCompact(data.sales)}
                  </span>
                  {data.cancelled > 0 ? (
                    <span className="text-[11px] text-danger dark:text-danger-400">
                      {data.cancelled} dibatalkan
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      Semua lancar
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle title="Ringkasan Penjualan (7 Hari)" />
          <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <AreaChart
              h={isMobile ? 180 : 230}
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
                content: (props) => (
                  <ChartCustomTooltip
                    {...props}
                    seriesLabels={{ penjualan: "Pendapatan" }}
                    valueFormatter={(v) => formatCurrency(Number(v))}
                  />
                ),
                allowEscapeViewBox: { x: false, y: false },
                offset: 8,
                position: undefined,
                wrapperStyle: { zIndex: 40, pointerEvents: "none" },
              }}
              xAxisProps={{
                tickMargin: 8,
                tick: { fontSize: 10, fill: "#6b7280" },
              }}
              yAxisProps={{
                tickFormatter: (v: number) => formatChartYAxis(Number(v)),
                tick: { fontSize: 10, fill: "#6b7280" },
                width: isMobile ? 42 : 52,
              }}
              areaChartProps={{
                margin: {
                  top: 8,
                  right: 8,
                  left: isMobile ? -10 : -4,
                  bottom: 0,
                },
              }}
              valueFormatter={(v) => formatCompact(Number(v))}
            />
          </div>
        </div>

        <div>
          <SectionTitle
            title="Pesanan Hari Ini"
            actionLabel="Buka di Menu Pesanan"
            onAction={() =>
              navigateWithOrderFilter({
                status: dashStatusFilter,
                payment: dashPaymentFilter,
                date: "today",
              })
            }
          />

          {/* Filter Status */}
          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto pb-1 mt-1 hide-scrollbar">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
              Status:
            </span>
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={dashStatusFilter === opt.value}
                label={opt.label}
                onClick={() =>
                  setDashStatusFilter(opt.value as OrderStatus | "all")
                }
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto pb-4 mt-1 hide-scrollbar">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1 shrink-0">
              Pembayaran:
            </span>
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={dashPaymentFilter === opt.value}
                label={opt.label}
                onClick={() =>
                  setDashPaymentFilter(opt.value as PaymentStatus | "all")
                }
              />
            ))}
            {(dashStatusFilter !== "all" || dashPaymentFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDashStatusFilter("all");
                  setDashPaymentFilter("all");
                }}
                className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline font-medium cursor-pointer bg-transparent border-0 ml-auto"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {filteredDashboardOrders.length === 0 && (
              <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
                Tidak ada pesanan yang sesuai filter.
              </div>
            )}
            {filteredDashboardOrders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                onClick={() => openOrderDetail(order.id)}
                className={`group p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 ${
                  statusBorderClass[order.status] ?? "border-l-primary-500"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                        {order.orderNumber}
                      </span>
                      <PlatformBadge
                        source={order.source}
                        showLabel={false}
                        iconSize={13}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0">
                      {order.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-sm text-primary-700 dark:text-primary-400 whitespace-nowrap">
                      {formatCurrency(order.total)}
                    </span>
                    <ChevronRightIcon
                      size={16}
                      className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
                    {order.customerName ?? "Walk-in"} ·{" "}
                    {order.items.reduce((s, i) => s + i.quantity, 0)} item ·{" "}
                    {formatTime(order.orderDate)}
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
                  onClick={() => navigate("menu")}
                  className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors group"
                  title="Lihat menu"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                      {item.quantity} terjual
                    </span>
                    <ChevronRightIcon
                      size={14}
                      className="text-gray-400 group-hover:text-gray-600 transition-colors"
                    />
                  </div>
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
                <p className="font-semibold text-danger dark:text-danger-400">
                  {formatCurrency(todaySummary.cancelledAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Belum dibayar
                </p>
                <p className="font-semibold text-warning dark:text-warning-400">
                  {formatCurrency(todaySummary.unpaidAmount)}
                </p>
              </div>
            </div>
            {!isClosed && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 px-3 py-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total</p>
                    <p className="mt-1 text-xl font-bold leading-none text-gray-900 dark:text-gray-100">
                      {todaySummary.totalOrders}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">pesanan</p>
                  </div>

                  <div className="rounded-xl border border-primary-100 dark:border-primary-900/50 bg-primary-50 dark:bg-primary-950/40 px-3 py-3">
                    <p className="text-xs font-medium text-primary-700 dark:text-primary-300">
                      Selesai
                    </p>
                    <p className="mt-1 text-xl font-bold leading-none text-primary-700 dark:text-primary-300">
                      {todaySummary.completedCount}
                    </p>
                    <p className="mt-1 text-[10px] text-primary dark:text-primary-400">pesanan</p>
                  </div>

                  <div className="rounded-xl border border-danger-100 dark:border-danger-900/50 bg-danger-50 dark:bg-danger-950/40 px-3 py-3">
                    <p className="text-xs font-medium text-danger dark:text-danger-400">
                      Dibatalkan
                    </p>
                    <p className="mt-1 text-xl font-bold leading-none text-danger dark:text-danger-400">
                      {todaySummary.cancelledCount}
                    </p>
                    <p className="mt-1 text-[10px] text-danger dark:text-danger-400">pesanan</p>
                  </div>
                </div>

                {/* Status penyelesaian */}
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-750 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Status pesanan
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {todaySummary.completedCount} dari{" "}
                        {todaySummary.totalOrders} pesanan selesai
                      </p>
                    </div>

                    <span className="text-sm font-bold text-primary dark:text-primary-400">
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

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-300"
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
                className="mt-6 py-2 px-4 rounded-lg bg-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0"
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
            <span className="text-xs text-danger dark:text-danger-400">
              {closeError}
            </span>
          )}
          {closeDone && (
            <span className="text-xs text-primary dark:text-primary-400">
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
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-60"
            >
              Konfirmasi Tutup
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
