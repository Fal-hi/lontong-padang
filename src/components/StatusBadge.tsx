import type { OrderStatus } from '../types';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils';

const colorMap: Record<string, string> = {
  yellow:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorKey = colorMap[getOrderStatusColor(status)] ?? colorMap.gray;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap font-medium rounded-full ${colorKey} ${
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
    >
      {getOrderStatusLabel(status)}
    </span>
  );
}
