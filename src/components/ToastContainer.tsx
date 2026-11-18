import { useNotificationStore, type NotificationItem } from '../stores/notificationStore';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  CloseIcon,
} from '../utils/icons';

const typeStyles = {
  success: {
    border: 'border-primary-200 dark:border-primary-800/80',
    iconBg: 'bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-400',
    icon: CheckCircleIcon,
    accent: 'bg-primary',
    glow: 'shadow-primary/10',
  },
  danger: {
    border: 'border-danger-200 dark:border-danger-800/80',
    iconBg: 'bg-danger-100 dark:bg-danger-950/60 text-danger dark:text-danger-400',
    icon: AlertCircleIcon,
    accent: 'bg-danger',
    glow: 'shadow-danger/10',
  },
  warning: {
    border: 'border-warning-200 dark:border-warning-800/80',
    iconBg: 'bg-warning-100 dark:bg-warning-950/60 text-warning-700 dark:text-warning-300',
    icon: AlertTriangleIcon,
    accent: 'bg-warning',
    glow: 'shadow-warning/10',
  },
  info: {
    border: 'border-info-200 dark:border-info-800/80',
    iconBg: 'bg-info-100 dark:bg-info-950/60 text-info-700 dark:text-info-300',
    icon: InfoIcon,
    accent: 'bg-info',
    glow: 'shadow-info/10',
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const style = typeStyles[item.type] ?? typeStyles.info;
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border ${style.border} bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg ${style.glow} p-3.5 flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-top-3 relative overflow-hidden`}
    >
      {/* Accent left indicator line */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-1 ${style.accent}`}
      />

      {/* Icon Badge */}
      <div
        className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${style.iconBg}`}
      >
        <Icon size={18} />
      </div>

      {/* Text details */}
      <div className="flex-1 min-w-0 pr-1">
        <h6 className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
          {item.title}
        </h6>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed break-words">
          {item.message}
        </p>
      </div>

      {/* Close button */}
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer border-0 bg-transparent"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissNotification = useNotificationStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Pemberitahuan Sistem"
      className="fixed top-4 inset-x-0 z-[9999] pointer-events-none flex flex-col items-center gap-2.5 px-4"
    >
      {notifications.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={dismissNotification}
        />
      ))}
    </aside>
  );
}
