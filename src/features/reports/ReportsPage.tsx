import { useMemo, useState } from "react";
import {
  PageContainer,
  StatCard,
  SectionTitle,
  FilterChip,
} from "../../components";
import { useOrderStore } from "../../stores/orderStore";
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  ORDER_SOURCES,
} from "../../constants";
import {
  addDays,
  computeDaySummary,
  formatCompact,
  formatCurrency,
  toDayKey,
  todayKey,
} from "../../utils";
import { BarChart } from "@mantine/charts";
import { useMediaQuery } from "@mantine/hooks";
import { FileBarChartIcon } from "../../utils/icons";
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
    },
    {
      label: "Gross Penjualan",
      value: summary.grossSales,
      icon: "dollar",
      isPrice: true,
    },
    {
      label: "Pesanan Selesai",
      value: summary.completedCount,
      icon: "check",
    },
    {
      label: "Dibatalkan",
      value: summary.cancelledCount,
      icon: "cancel",
    },
    {
      label: "Belum Dibayar",
      value: summary.unpaidCount,
      icon: "wallet",
    },
    {
      label: "Rata-rata Pesanan",
      value: summary.avgOrderValue,
      icon: "trending",
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
          <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <BarChart
              h={isMobile ? 190 : 260}
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
                contentStyle: CHART_TOOLTIP_STYLE,
              }}
              xAxisProps={{
                tickMargin: 8,
                tick: { fontSize: isMobile ? 10 : 12 },
              }}
              yAxisProps={{
                tickFormatter: (v: number) => `${(v / 1_000_000).toFixed(0)}jt`,
                tick: { fontSize: isMobile ? 10 : 12 },
                width: isMobile ? 36 : 55,
              }}
              valueFormatter={(v) => formatCompact(Number(v))}
              barProps={{
                barSize: isMobile ? 10 : 18,
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
                    <div key={source.value} className="px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlatformBadge
                            source={source.value}
                            showLabel={false}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {source.label} · {data.orders} pesanan
                          </span>
                        </div>
                        <span className="font-semibold text-sm dark:text-gray-100 whitespace-nowrap">
                          {formatCurrency(data.sales)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
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
                    className="flex items-center justify-between gap-2 px-3.5 py-3"
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
                      {item.quantity} pcs
                    </span>
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
