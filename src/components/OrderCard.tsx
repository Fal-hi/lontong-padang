import type { Order } from "../types";
import { formatCurrency, formatDateTime } from "../utils";
import { ChevronRightIcon } from "../utils/icons";
import PlatformBadge from "./PlatformBadge";
import StatusBadge from "./StatusBadge";
import PaymentBadge from "./PaymentBadge";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  onCancel?: (order: Order) => void;
  isStaff?: boolean;
}

const statusBorderMap: Record<string, string> = {
  selesai: "border-l-primary-500",
  diproses: "border-l-info-500",
  baru: "border-l-warning-500",
  dibatalkan: "border-l-danger-500",
};

export default function OrderCard({
  order,
  onClick,
  onCancel,
  isStaff,
}: OrderCardProps) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const borderLeft = statusBorderMap[order.status] ?? "border-l-primary-500";

  const isProcessing = order.status === "diproses";
  const isCompletedUnpaid =
    order.status === "selesai" && order.paymentStatus === "belum_dibayar";

  return (
    <div
      className={`group p-3.5 rounded-xl border transition-all duration-200 order-card hover:shadow-md active:scale-[0.99] border-l-4 ${
        isCompletedUnpaid ? "border-l-warning-500" : borderLeft
      } ${
        isProcessing
          ? "border-info-300 dark:border-info-700 bg-info-50/50 dark:bg-info-950/20 shadow-xs ring-1 ring-info-400/20"
          : isCompletedUnpaid
            ? "border-warning-300 dark:border-warning-700 bg-warning-50/50 dark:bg-warning-950/20 shadow-xs ring-1 ring-warning-400/30"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 gap-1 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
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
            {isProcessing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-info-700 dark:text-info-300 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-info-500 animate-pulse" />
                Harap segera diselesaikan
              </span>
            )}
            {isCompletedUnpaid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning-700 dark:text-warning-300 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                Selesai — Belum Bayar
              </span>
            )}
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
            <span className="font-bold text-sm text-primary-700 dark:text-primary-400">
              {formatCurrency(order.total)}
            </span>
          </div>

          {order.status !== "dibatalkan" && onCancel && (
            <div
              className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {order.status === "selesai" && isStaff ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 w-full justify-between">
                  <button
                    type="button"
                    disabled
                    title="Hanya super admin yang dapat membatalkan pesanan selesai"
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700"
                  >
                    Batalkan
                  </button>
                  <span className="text-[11px] truncate">
                    Hanya super admin yang dapat membatalkan pesanan selesai
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onCancel(order)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-danger dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/50 border border-danger-200 dark:border-danger-800/60 transition-colors cursor-pointer"
                >
                  Batalkan
                </button>
              )}
            </div>
          )}
        </div>
        <ChevronRightIcon
          size={16}
          className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 group-hover:translate-x-0.5 transition-all ml-2 shrink-0"
        />
      </div>
    </div>
  );
}
