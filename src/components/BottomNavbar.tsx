import { useNavStore } from "../stores/navStore";
import { NAV_ITEMS } from "../constants";
import type { NavPage } from "../types";
import {
  CalculatorIcon,
  DashboardIcon,
  MenuIcon,
  OrdersIcon,
  ReportsIcon,
  SettingsIcon,
} from "../utils/icons";

const iconMap: Record<
  string,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  dashboard: DashboardIcon,
  orders: OrdersIcon,
  menu: MenuIcon,
  calculator: CalculatorIcon,
  reports: ReportsIcon,
  settings: SettingsIcon,
};

export default function BottomNavbar() {
  const currentPage = useNavStore((state) => state.currentPage);
  const navigate = useNavStore((state) => state.navigate);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[60px] box-content bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between w-full max-w-md mx-auto px-1 h-[60px]">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon] ?? DashboardIcon;
          const isActive = currentPage === item.page;

          return (
            <button
              key={item.page}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 h-full py-1 px-0.5 rounded-xl transition-all cursor-pointer border-0 active:scale-95 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              onClick={() => navigate(item.page as NavPage)}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? "bg-emerald-50 dark:bg-emerald-950/60" : ""}`}>
                <Icon size={19} color={isActive ? "#059669" : "#6b7280"} />
              </div>
              <span className="text-[10px] leading-tight truncate mt-0.5 max-w-full text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
