import { create } from 'zustand';

export type NotificationType = 'success' | 'danger' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

export interface ShowNotificationInput {
  type?: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  showNotification: (input: ShowNotificationInput) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATION = 3500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  showNotification: (input) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = input.duration ?? DEFAULT_DURATION;

    const defaultTitles: Record<NotificationType, string> = {
      success: 'Berhasil',
      danger: 'Gagal / Perhatian',
      warning: 'Peringatan',
      info: 'Informasi',
    };

    const type = input.type ?? 'info';
    const title = input.title || defaultTitles[type];

    const newItem: NotificationItem = {
      id,
      type,
      title,
      message: input.message,
      duration,
    };

    // Keep max 4 notifications at a time to prevent mobile screen clutter
    set((state) => ({
      notifications: [...state.notifications.slice(-3), newItem],
    }));

    if (duration > 0) {
      const timer = setTimeout(() => {
        get().dismissNotification(id);
      }, duration);
      timers.set(id, timer);
    }

    return id;
  },

  dismissNotification: (id) => {
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ notifications: [] });
  },
}));

/**
 * Convenient static helper to trigger notifications anywhere.
 */
export const notify = {
  success: (message: string, title = 'Berhasil') =>
    useNotificationStore.getState().showNotification({ type: 'success', title, message }),

  danger: (message: string, title = 'Perhatian') =>
    useNotificationStore.getState().showNotification({ type: 'danger', title, message }),

  error: (message: string, title = 'Terjadi Kesalahan') =>
    useNotificationStore.getState().showNotification({ type: 'danger', title, message }),

  warning: (message: string, title = 'Peringatan') =>
    useNotificationStore.getState().showNotification({ type: 'warning', title, message }),

  info: (message: string, title = 'Informasi') =>
    useNotificationStore.getState().showNotification({ type: 'info', title, message }),
};
