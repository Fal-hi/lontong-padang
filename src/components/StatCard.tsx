import {
  CircleDollarIcon,
  OrdersIcon,
  TrendingUpIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  WalletIcon,
  CrownIcon,
  BanknoteIcon,
  ArrowUpRightIcon,
} from '../utils/icons';
import { formatCurrency, formatNumber } from '../utils';

type StatCardColor =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'warning'
  | 'info'
  | 'emerald'
  | 'blue'
  | 'teal'
  | 'red'
  | 'amber'
  | 'purple'
  | 'gray';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  isPrice?: boolean;
  color?: StatCardColor;
  onClick?: () => void;
}

const iconMap: Record<
  string,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  dollar: CircleDollarIcon,
  orders: OrdersIcon,
  trending: TrendingUpIcon,
  users: UsersIcon,
  clock: ClockIcon,
  check: CheckCircleIcon,
  cancel: XCircleIcon,
  wallet: WalletIcon,
  crown: CrownIcon,
  banknote: BanknoteIcon,
};

const defaultColorByIcon: Record<string, StatCardColor> = {
  dollar: 'primary',
  orders: 'info',
  check: 'primary',
  cancel: 'danger',
  wallet: 'warning',
  trending: 'secondary',
};

const colorStyles: Record<
  StatCardColor,
  {
    iconBg: string;
    iconFg: string;
    border: string;
    hoverBorder: string;
    cardBg: string;
    shortcutFg: string;
  }
> = {
  primary: {
    iconBg: 'bg-primary-100/80 dark:bg-primary-950/60',
    iconFg: '#059669',
    border: 'border-primary-100 dark:border-primary-900/40',
    hoverBorder: 'hover:border-primary-400 hover:bg-primary-50/20 dark:hover:bg-primary-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#059669',
  },
  secondary: {
    iconBg: 'bg-secondary-100/80 dark:bg-secondary-950/60',
    iconFg: '#7c3aed',
    border: 'border-secondary-100 dark:border-secondary-900/40',
    hoverBorder: 'hover:border-secondary-400 hover:bg-secondary-50/20 dark:hover:bg-secondary-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#7c3aed',
  },
  danger: {
    iconBg: 'bg-danger-100/80 dark:bg-danger-950/60',
    iconFg: '#dc2626',
    border: 'border-danger-100 dark:border-danger-900/40',
    hoverBorder: 'hover:border-danger-400 hover:bg-danger-50/20 dark:hover:bg-danger-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#dc2626',
  },
  warning: {
    iconBg: 'bg-warning-100/80 dark:bg-warning-950/60',
    iconFg: '#d97706',
    border: 'border-warning-100 dark:border-warning-900/40',
    hoverBorder: 'hover:border-warning-400 hover:bg-warning-50/20 dark:hover:bg-warning-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#d97706',
  },
  info: {
    iconBg: 'bg-info-100/80 dark:bg-info-950/60',
    iconFg: '#2563eb',
    border: 'border-info-100 dark:border-info-900/40',
    hoverBorder: 'hover:border-info-400 hover:bg-info-50/20 dark:hover:bg-info-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#2563eb',
  },
  emerald: {
    iconBg: 'bg-primary-100/80 dark:bg-primary-950/60',
    iconFg: '#059669',
    border: 'border-primary-100 dark:border-primary-900/40',
    hoverBorder: 'hover:border-primary-400 hover:bg-primary-50/20 dark:hover:bg-primary-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#059669',
  },
  blue: {
    iconBg: 'bg-info-100/80 dark:bg-info-950/60',
    iconFg: '#2563eb',
    border: 'border-info-100 dark:border-info-900/40',
    hoverBorder: 'hover:border-info-400 hover:bg-info-50/20 dark:hover:bg-info-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#2563eb',
  },
  teal: {
    iconBg: 'bg-teal-100/80 dark:bg-teal-950/60',
    iconFg: '#0d9488',
    border: 'border-teal-100 dark:border-teal-900/40',
    hoverBorder: 'hover:border-teal-400 hover:bg-teal-50/20 dark:hover:bg-teal-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#0d9488',
  },
  red: {
    iconBg: 'bg-danger-100/80 dark:bg-danger-950/60',
    iconFg: '#dc2626',
    border: 'border-danger-100 dark:border-danger-900/40',
    hoverBorder: 'hover:border-danger-400 hover:bg-danger-50/20 dark:hover:bg-danger-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#dc2626',
  },
  amber: {
    iconBg: 'bg-warning-100/80 dark:bg-warning-950/60',
    iconFg: '#d97706',
    border: 'border-warning-100 dark:border-warning-900/40',
    hoverBorder: 'hover:border-warning-400 hover:bg-warning-50/20 dark:hover:bg-warning-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#d97706',
  },
  purple: {
    iconBg: 'bg-secondary-100/80 dark:bg-secondary-950/60',
    iconFg: '#7c3aed',
    border: 'border-secondary-100 dark:border-secondary-900/40',
    hoverBorder: 'hover:border-secondary-400 hover:bg-secondary-50/20 dark:hover:bg-secondary-950/20',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#7c3aed',
  },
  gray: {
    iconBg: 'bg-gray-100 dark:bg-gray-700',
    iconFg: '#6b7280',
    border: 'border-gray-200 dark:border-gray-700',
    hoverBorder: 'hover:border-gray-400',
    cardBg: 'bg-white dark:bg-gray-800',
    shortcutFg: '#6b7280',
  },
};

export default function StatCard({
  label,
  value,
  icon,
  change,
  changeType,
  isPrice,
  color,
  onClick,
}: StatCardProps) {
  const Icon = iconMap[icon] ?? CircleDollarIcon;
  const cardColor = color ?? defaultColorByIcon[icon] ?? 'primary';
  const theme = colorStyles[cardColor] ?? colorStyles.primary;

  const changeColor =
    changeType === 'positive'
      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
      : changeType === 'negative'
        ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  const displayValue =
    typeof value === 'number'
      ? isPrice
        ? formatCurrency(value)
        : formatNumber(value)
      : value;

  const interactiveClasses = onClick
    ? `group relative cursor-pointer text-left transition-all duration-200 hover:shadow-md active:scale-97 ${theme.hoverBorder}`
    : '';

  const content = (
    <>
      <div className="flex justify-between items-start gap-1">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
            onClick ? 'group-hover:scale-105' : ''
          } ${theme.iconBg}`}
        >
          <Icon size={18} color={theme.iconFg} />
        </div>
        <div className="flex items-center gap-1">
          {change && (
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${changeColor}`}
            >
              {change}
            </span>
          )}
          {onClick && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
              <ArrowUpRightIcon size={13} color={theme.shortcutFg} />
            </div>
          )}
        </div>
      </div>
      <h3 className="font-bold text-lg leading-tight overflow-hidden text-ellipsis whitespace-nowrap dark:text-white">
        {displayValue}
      </h3>
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight truncate">
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Buka ${label}`}
        className={`p-3.5 rounded-2xl border ${theme.border} ${theme.cardBg} flex flex-col gap-1.5 min-w-0 ${interactiveClasses}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`p-3.5 rounded-2xl border ${theme.border} ${theme.cardBg} flex flex-col gap-1.5 min-w-0`}
    >
      {content}
    </div>
  );
}