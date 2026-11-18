import { useAuthStore } from '../stores/authStore';
import { useStoreStore } from '../stores/storeStore';
import { AppAvatar } from '../components';
import { formatCurrentDate, getGreeting } from '../utils';
import { BellIcon, SearchIcon } from '../utils/icons';

export default function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);

  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 w-full max-w-md mx-auto">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <AppAvatar user={user} size="sm" />
        <div className="flex flex-col gap-0 min-w-0">
          <span className="font-semibold text-sm leading-tight truncate">
            {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'User'}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight truncate">
            {store.name} · {formatCurrentDate()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label="Cari"
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer bg-transparent border-0"
        >
          <SearchIcon size={19} color="#6b7280" />
        </button>
        <button
          type="button"
          aria-label="Notifikasi"
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer bg-transparent border-0"
        >
          <BellIcon size={19} color="#6b7280" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
