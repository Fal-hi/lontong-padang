import type { OrderSource } from '../types';
import { getOrderSourceLabel } from '../constants';
import { StoreIcon } from '../utils/icons';
import type { ComponentType } from 'react';

interface PlatformMeta {
  color: string;
  bg: string;
  logo?: string;
  Icon?: ComponentType<{ size?: number; color?: string }>;
}

const PLATFORM_META: Record<OrderSource, PlatformMeta> = {
  grab: {
    color: '#16a34a',
    bg: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    logo: '/logo/grabfood.png',
  },
  gofood: {
    color: '#dc2626',
    bg: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300',
    logo: '/logo/gofood.png',
  },
  shopeefood: {
    color: '#2563eb',
    bg: 'bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300',
    logo: '/logo/shopeefood.png',
  },
  manual: {
    color: '#6b7280',
    bg: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    Icon: StoreIcon,
  },
};

interface PlatformBadgeProps {
  source: OrderSource;
  showLabel?: boolean;
  iconSize?: number;
}

export default function PlatformBadge({
  source,
  showLabel = true,
  iconSize = 14,
}: PlatformBadgeProps) {
  const meta = PLATFORM_META[source];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-xs px-2.5 py-1 rounded-full ${meta.bg}`}
    >
      {meta.logo ? (
        <img
          src={meta.logo}
          alt={getOrderSourceLabel(source)}
          className="object-contain shrink-0 rounded-sm"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : meta.Icon ? (
        <meta.Icon size={iconSize} color={meta.color} />
      ) : null}
      {showLabel && getOrderSourceLabel(source)}
    </span>
  );
}
