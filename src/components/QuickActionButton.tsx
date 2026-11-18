import {
  PlusIcon,
  MenuIcon,
  ReportsIcon,
  UsersIcon,
  OrdersIcon,
  DashboardIcon,
  CalculatorIcon,
  StoreIcon,
  CalendarIcon,
  ShoppingCartIcon,
} from '../utils/icons';
import { useNavStore } from '../stores/navStore';
import type { NavPage } from '../types';

interface QuickActionButtonProps {
  label: string;
  icon: string;
  color: string;
  description?: string;
  page?: NavPage;
  action?: 'new-order';
  onClick?: () => void;
}

const iconMap: Record<
  string,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  plus: PlusIcon,
  menu: MenuIcon,
  reports: ReportsIcon,
  users: UsersIcon,
  orders: OrdersIcon,
  dashboard: DashboardIcon,
  calculator: CalculatorIcon,
  store: StoreIcon,
  calendar: CalendarIcon,
  cart: ShoppingCartIcon,
};

const colorMap: Record<string, { bg: string; fg: string }> = {
  green: { bg: '#ecfdf5', fg: '#059669' },
  blue: { bg: '#eff6ff', fg: '#2563eb' },
  orange: { bg: '#fff7ed', fg: '#ea580c' },
  purple: { bg: '#f5f3ff', fg: '#7c3aed' },
  red: { bg: '#fef2f2', fg: '#dc2626' },
  gray: { bg: '#f3f4f6', fg: '#4b5563' },
};

export default function QuickActionButton({
  label,
  icon,
  color,
  page,
  action,
  onClick,
}: QuickActionButtonProps) {
  const navigate = useNavStore((s) => s.navigate);
  const openNewOrder = useNavStore((s) => s.openNewOrder);
  const Icon = iconMap[icon] ?? PlusIcon;
  const colors = colorMap[color] ?? colorMap.green;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (action === 'new-order') {
      openNewOrder();
    } else if (page) {
      navigate(page);
    }
  };

  return (
    <button
      type="button"
      className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center cursor-pointer transition-all quick-action-btn flex flex-col items-center gap-1 min-w-0"
      onClick={handleClick}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: colors.bg }}
      >
        <Icon size={20} color={colors.fg} />
      </div>
      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 leading-tight w-full text-center">
        {label}
      </span>
    </button>
  );
}
