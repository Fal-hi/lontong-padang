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
} from '../utils/icons';
import { formatCurrency, formatNumber } from '../utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  isPrice?: boolean;
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

export default function StatCard({
  label,
  value,
  icon,
  change,
  changeType,
  isPrice,
}: StatCardProps) {
  const Icon = iconMap[icon] ?? CircleDollarIcon;

  const changeColor =
    changeType === 'positive'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : changeType === 'negative'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  const displayValue =
    typeof value === 'number'
      ? isPrice
        ? formatCurrency(value)
        : formatNumber(value)
      : value;

  return (
    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col gap-1.5 min-w-0">
      <div className="flex justify-between items-start gap-1">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
          <Icon size={18} color="#059669" />
        </div>
        {change && (
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${changeColor}`}
          >
            {change}
          </span>
        )}
      </div>
      <h3 className="font-bold text-lg leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
        {displayValue}
      </h3>
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight truncate">
        {label}
      </span>
    </div>
  );
}
