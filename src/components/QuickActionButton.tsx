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
  ArrowUpRightIcon,
} from '../utils/icons';
import { useNavStore } from '../stores/navStore';
import type { NavPage } from '../types';

interface QuickActionButtonProps {
  label: string;
  icon: string;
  color?: string;
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

const themeStyles: Record<
  string,
  {
    cardBg: string;
    border: string;
    iconBg: string;
    iconFg: string;
    text: string;
    arrowColor: string;
    glow: string;
  }
> = {
  primary: {
    cardBg: 'bg-gradient-to-br from-primary-50 via-white to-primary-50/50 dark:from-primary-950/40 dark:via-gray-800 dark:to-primary-950/20',
    border: 'border-primary-300/80 dark:border-primary-800 hover:border-primary-500 shadow-xs shadow-primary-500/10',
    iconBg: 'bg-primary text-white shadow-sm shadow-primary/30',
    iconFg: '#ffffff',
    text: 'text-primary-900 dark:text-primary-100',
    arrowColor: '#059669',
    glow: 'hover:shadow-primary-500/15',
  },
  green: {
    cardBg: 'bg-gradient-to-br from-primary-50 via-white to-primary-50/50 dark:from-primary-950/40 dark:via-gray-800 dark:to-primary-950/20',
    border: 'border-primary-300/80 dark:border-primary-800 hover:border-primary-500 shadow-xs shadow-primary-500/10',
    iconBg: 'bg-primary text-white shadow-sm shadow-primary/30',
    iconFg: '#ffffff',
    text: 'text-primary-900 dark:text-primary-100',
    arrowColor: '#059669',
    glow: 'hover:shadow-primary-500/15',
  },
  info: {
    cardBg: 'bg-gradient-to-br from-info-50 via-white to-info-50/50 dark:from-info-950/40 dark:via-gray-800 dark:to-info-950/20',
    border: 'border-info-300/80 dark:border-info-800 hover:border-info-500 shadow-xs shadow-info-500/10',
    iconBg: 'bg-info text-white shadow-sm shadow-info/30',
    iconFg: '#ffffff',
    text: 'text-info-900 dark:text-info-100',
    arrowColor: '#2563eb',
    glow: 'hover:shadow-info-500/15',
  },
  blue: {
    cardBg: 'bg-gradient-to-br from-info-50 via-white to-info-50/50 dark:from-info-950/40 dark:via-gray-800 dark:to-info-950/20',
    border: 'border-info-300/80 dark:border-info-800 hover:border-info-500 shadow-xs shadow-info-500/10',
    iconBg: 'bg-info text-white shadow-sm shadow-info/30',
    iconFg: '#ffffff',
    text: 'text-info-900 dark:text-info-100',
    arrowColor: '#2563eb',
    glow: 'hover:shadow-info-500/15',
  },
  secondary: {
    cardBg: 'bg-gradient-to-br from-secondary-50 via-white to-secondary-50/50 dark:from-secondary-950/40 dark:via-gray-800 dark:to-secondary-950/20',
    border: 'border-secondary-300/80 dark:border-secondary-800 hover:border-secondary-500 shadow-xs shadow-secondary-500/10',
    iconBg: 'bg-secondary text-white shadow-sm shadow-secondary/30',
    iconFg: '#ffffff',
    text: 'text-secondary-900 dark:text-secondary-100',
    arrowColor: '#7c3aed',
    glow: 'hover:shadow-secondary-500/15',
  },
  purple: {
    cardBg: 'bg-gradient-to-br from-secondary-50 via-white to-secondary-50/50 dark:from-secondary-950/40 dark:via-gray-800 dark:to-secondary-950/20',
    border: 'border-secondary-300/80 dark:border-secondary-800 hover:border-secondary-500 shadow-xs shadow-secondary-500/10',
    iconBg: 'bg-secondary text-white shadow-sm shadow-secondary/30',
    iconFg: '#ffffff',
    text: 'text-secondary-900 dark:text-secondary-100',
    arrowColor: '#7c3aed',
    glow: 'hover:shadow-secondary-500/15',
  },
  warning: {
    cardBg: 'bg-gradient-to-br from-warning-50 via-white to-warning-50/50 dark:from-warning-950/40 dark:via-gray-800 dark:to-warning-950/20',
    border: 'border-warning-300/80 dark:border-warning-800 hover:border-warning-500 shadow-xs shadow-warning-500/10',
    iconBg: 'bg-warning text-white shadow-sm shadow-warning/30',
    iconFg: '#ffffff',
    text: 'text-warning-900 dark:text-warning-100',
    arrowColor: '#d97706',
    glow: 'hover:shadow-warning-500/15',
  },
  orange: {
    cardBg: 'bg-gradient-to-br from-warning-50 via-white to-warning-50/50 dark:from-warning-950/40 dark:via-gray-800 dark:to-warning-950/20',
    border: 'border-warning-300/80 dark:border-warning-800 hover:border-warning-500 shadow-xs shadow-warning-500/10',
    iconBg: 'bg-warning text-white shadow-sm shadow-warning/30',
    iconFg: '#ffffff',
    text: 'text-warning-900 dark:text-warning-100',
    arrowColor: '#d97706',
    glow: 'hover:shadow-warning-500/15',
  },
  danger: {
    cardBg: 'bg-gradient-to-br from-danger-50 via-white to-danger-50/50 dark:from-danger-950/40 dark:via-gray-800 dark:to-danger-950/20',
    border: 'border-danger-300/80 dark:border-danger-800 hover:border-danger-500 shadow-xs shadow-danger-500/10',
    iconBg: 'bg-danger text-white shadow-sm shadow-danger/30',
    iconFg: '#ffffff',
    text: 'text-danger-900 dark:text-danger-100',
    arrowColor: '#dc2626',
    glow: 'hover:shadow-danger-500/15',
  },
  red: {
    cardBg: 'bg-gradient-to-br from-danger-50 via-white to-danger-50/50 dark:from-danger-950/40 dark:via-gray-800 dark:to-danger-950/20',
    border: 'border-danger-300/80 dark:border-danger-800 hover:border-danger-500 shadow-xs shadow-danger-500/10',
    iconBg: 'bg-danger text-white shadow-sm shadow-danger/30',
    iconFg: '#ffffff',
    text: 'text-danger-900 dark:text-danger-100',
    arrowColor: '#dc2626',
    glow: 'hover:shadow-danger-500/15',
  },
  gray: {
    cardBg: 'bg-gradient-to-br from-gray-50 via-white to-gray-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800',
    border: 'border-gray-200 dark:border-gray-700 hover:border-gray-400',
    iconBg: 'bg-gray-600 text-white',
    iconFg: '#ffffff',
    text: 'text-gray-900 dark:text-gray-100',
    arrowColor: '#6b7280',
    glow: 'hover:shadow-gray-500/15',
  },
};

export default function QuickActionButton({
  label,
  icon,
  color = 'primary',
  page,
  action,
  onClick,
}: QuickActionButtonProps) {
  const navigate = useNavStore((s) => s.navigate);
  const openNewOrder = useNavStore((s) => s.openNewOrder);
  const Icon = iconMap[icon] ?? PlusIcon;
  const theme = themeStyles[color] ?? themeStyles.primary;

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
      className={`group relative p-2.5 rounded-2xl border text-center cursor-pointer transition-all duration-200 quick-action-btn flex flex-col items-center justify-between gap-1.5 min-w-0 hover:shadow-md active:scale-95 ${theme.cardBg} ${theme.border} ${theme.glow}`}
      onClick={handleClick}
      title={`Buka menu ${label}`}
    >
      {/* Top right quick shortcut indicator */}
      <div className="absolute top-1.5 right-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
        <ArrowUpRightIcon size={12} color={theme.arrowColor} />
      </div>

      {/* Highlight icon container */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95 ${theme.iconBg}`}
      >
        <Icon size={20} color={theme.iconFg} />
      </div>

      {/* Label with highlighted typography */}
      <span className={`text-[11px] font-semibold leading-tight w-full text-center truncate ${theme.text}`}>
        {label}
      </span>
    </button>
  );
}
