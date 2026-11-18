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
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      } ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
    >
      <Icon size={size === 'sm' ? 11 : 13} />
      {getPaymentStatusLabel(status)}
    </span>
  );
}
