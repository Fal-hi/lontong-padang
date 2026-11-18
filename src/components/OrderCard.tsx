import type { Order } from "../types";
import { formatCurrency, formatDateTime } from "../utils";
import { ChevronRightIcon } from "../utils/icons";
import PlatformBadge from "./PlatformBadge";
import StatusBadge from "./StatusBadge";
import PaymentBadge from "./PaymentBadge";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
}

export default function OrderCard({ order, onClick }: OrderCardProps) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      className={`p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-shadow order-card active:scale-[0.99] ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 gap-1 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm truncate">
              {order.orderNumber}
            </span>
            <div className="flex items-center gap-2">
              <PaymentBadge status={order.paymentStatus} size="sm" />
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlatformBadge source={order.source} showLabel={false} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {order.source}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2 flex-wrap mt-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(order.orderDate)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {order.customerName ?? "Pelanggan walk-in"} |{" "}
                <b>{itemCount} item</b>
              </span>
            </div>
            <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>
        <ChevronRightIcon size={16} color="#9ca3af" />
      </div>
    </div>
  );
}
