import type { PaymentStatus } from '../types';
import { getPaymentStatusLabel } from '../utils';
import { WalletIcon, CreditCardIcon } from '../utils/icons';

interface PaymentBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export default function PaymentBadge({ status, size = 'md' }: PaymentBadgeProps) {
  const paid = status === 'dibayar';
  const Icon = paid ? CreditCardIcon : WalletIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap font-medium rounded-full ${
        paid
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
          : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
      } ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
    >
      <Icon size={size === 'sm' ? 11 : 13} />
      {getPaymentStatusLabel(status)}
    </span>
  );
}