import type { OrderStatus } from '../types';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils';

const colorMap: Record<string, string> = {
  warning:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  yellow:
    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  info: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
  blue: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
  primary:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  green:
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  red: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
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