import { useMemo, useState } from "react";
import {
  PageContainer,
  StatCard,
  SectionTitle,
  FilterChip,
  ChartCustomTooltip,
} from "../../components";
import { useOrderStore } from "../../stores/orderStore";
import { useNavStore } from "../../stores/navStore";
import {
  CHART_COLORS,
  ORDER_SOURCES,
} from "../../constants";
import {
  addDays,
  computeDaySummary,
  formatChartYAxis,
  formatCompact,
  formatCurrency,
  toDayKey,
  todayKey,
} from "../../utils";
import { BarChart } from "@mantine/charts";
import { useMediaQuery } from "@mantine/hooks";
import { FileBarChartIcon, ChevronRightIcon } from "../../utils/icons";
import PlatformBadge from "../../components/PlatformBadge";

type Period = "today" | "week" | "month" | "all";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "today", label: "Harian" },
  { key: "week", label: "Mingguan" },
  { key: "month", label: "Bulanan" },
  { key: "all", label: "Semua" },
];

function periodLabel(period: Period): string {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  switch (period) {
    case "today":
      return `Hari ini (${fmt.format(new Date())})`;
    case "week":
      return `7 hari terakhir (${fmt.format(addDays(new Date(), -6))} – ${fmt.format(
        new Date(),
      )})`;
    case "month": {
      const now = new Date();
      const month = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(now);
      return `Bulan ini (${month})`;
    }
    case "all":
      return "Semua data tercatat";
  }
}

export default function ReportsPage() {
  const navigate = useNavStore((s) => s.navigate);
  const orders = useOrderStore((s) => s.orders);
  const [period, setPeriod] = useState<Period>("today");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const filteredOrders = useMemo(() => {
    const today = todayKey();
    const weekStart = toDayKey(addDays(new Date(), -6));
    const monthPrefix = today.slice(0, 7);
    return orders.filter((o) => {
      if (period === "today") return o.dayKey === today;
      if (period === "week") return o.dayKey >= weekStart;
      if (period === "month") return o.dayKey.startsWith(monthPrefix);
      return true;
    });
  }, [orders, period]);

  const summary = useMemo(
    () => computeDaySummary(filteredOrders),
    [filteredOrders],
  );

  const bestSelling = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    for (const order of filteredOrders) {
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
  }, [filteredOrders]);

  const weekSeries = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayKey = toDayKey(addDays(new Date(), i - 6));
      const s = computeDaySummary(orders.filter((o) => o.dayKey === dayKey));
      return {
        date: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(
          new Date(`${dayKey}T00:00:00`),
        ),
        penjualan: s.grossSales,
        selesai: s.completedSales,
      };
    });
    return days;
  }, [orders]);

  const stats = [
    {
      label: "Total Pesanan",
      value: summary.totalOrders,
      icon: "orders",
      color: "blue" as const,
      onClick: () => navigate("orders"),
    },
    {
      label: "Gross Penjualan",
      value: summary.grossSales,
      icon: "dollar",
      color: "primary" as const,
      isPrice: true,
    },
    {
      label: "Pesanan Selesai",
      value: summary.completedCount,
      icon: "check",
      color: "teal" as const,
      onClick: () => navigate("orders"),
    },
    {
      label: "Dibatalkan",
      value: summary.cancelledCount,
      icon: "cancel",
      color: "red" as const,
      onClick: () => navigate("orders"),
    },
    {
      label: "Belum Dibayar",
      value: summary.unpaidCount,
      icon: "wallet",
      color: "amber" as const,
      onClick: () => navigate("orders"),
    },
    {
      label: "Rata-rata Pesanan",
      value: summary.avgOrderValue,
      icon: "trending",
      color: "purple" as const,
      isPrice: true,
    },
  ];

  return (
    <PageContainer>
      <section className="flex flex-col gap-4">
        <SectionTitle title="Laporan" />

        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1 hide-scrollbar">
          {PERIODS.map((p) => (
            <FilterChip
              key={p.key}
              active={period === p.key}
              label={p.label}
              onClick={() => setPeriod(p.key)}
            />
          ))}
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {periodLabel(period)} · {filteredOrders.length} pesanan
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div>
          <SectionTitle title="Pendapatan 7 Hari Terakhir" />
          <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <BarChart
              h={isMobile ? 180 : 250}
              data={weekSeries}
              dataKey="date"
              series={[
                {
                  name: "penjualan",
                  color: CHART_COLORS.revenue,
                  label: "Gross",
                },
                {
                  name: "selesai",
                  color: CHART_COLORS.completed,
                  label: "Selesai",
                },
              ]}
              tickLine="y"
              gridAxis="x"
              withTooltip
              tooltipProps={{
                content: (props) => (
                  <ChartCustomTooltip
                    {...props}
                    seriesLabels={{ penjualan: "Gross", selesai: "Selesai" }}
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
              barChartProps={{
                margin: {
                  top: 8,
                  right: 8,
                  left: isMobile ? -10 : -4,
                  bottom: 0,
                },
              }}
              valueFormatter={(v) => formatCompact(Number(v))}
              barProps={{
                barSize: isMobile ? 10 : 16,
                radius: [4, 4, 0, 0],
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <SectionTitle title="Total per Platform" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                {ORDER_SOURCES.map((source) => {
                  const data = summary.byPlatform[source.value];
                  const maxSales = Math.max(
                    1,
                    ...ORDER_SOURCES.map(
                      (s) => summary.byPlatform[s.value].sales,
                    ),
                  );
                  const pct = summary.byPlatform[source.value].sales / maxSales;
                  return (
                    <div
                      key={source.value}
                      onClick={() => navigate("orders")}
                      className="px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors group"
                      title={`Lihat pesanan ${source.label}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlatformBadge
                            source={source.value}
                            showLabel={false}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                            {source.label} · {data.orders} pesanan
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-semibold text-sm dark:text-gray-100 whitespace-nowrap">
                            {formatCurrency(data.sales)}
                          </span>
                          <ChevronRightIcon
                            size={14}
                            className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                      <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                        <span>{data.cancelled} dibatalkan</span>
                        <span>{data.unpaid} belum dibayar</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <SectionTitle title="Menu Terlaris" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                {bestSelling.length === 0 && (
                  <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data penjualan untuk periode ini.
                  </p>
                )}
                {bestSelling.map((item, i) => (
                  <div
                    key={item.menuId}
                    onClick={() => navigate("menu")}
                    className="flex items-center justify-between gap-2 px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors group"
                    title="Buka menu"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                        {item.quantity} pcs
                      </span>
                      <ChevronRightIcon
                        size={14}
                        className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5 flex items-start gap-2.5">
          <FileBarChartIcon
            size={16}
            color="#6b7280"
            className="shrink-0 mt-0.5"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
            Laporan dihitung dari data pesanan yang tercatat. Gross tidak
            memperhitungkan biaya layanan/komisi platform.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
