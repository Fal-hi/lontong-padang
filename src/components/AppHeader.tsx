import { useAuthStore } from '../stores/authStore';
import { useStoreStore } from '../stores/storeStore';
import { useNavStore } from '../stores/navStore';
import { useSoundStore } from '../stores/soundStore';
import { AppAvatar } from '../components';
import { formatCurrentDate, getGreeting } from '../utils';
import { BellIcon, SearchIcon, VolumeIcon, VolumeMuteIcon } from '../utils/icons';
import { notify } from '../stores/notificationStore';
import { sound } from '../utils/sound';

export default function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const store = useStoreStore((s) => s.store);
  const navigate = useNavStore((s) => s.navigate);
  const soundEnabled = useSoundStore((s) => s.soundEnabled);
  const toggleSound = useSoundStore((s) => s.toggleSound);

  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 w-full max-w-md mx-auto">
      <button
        type="button"
        onClick={() => navigate('settings')}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer bg-transparent border-0 p-0 active:scale-98 transition-transform group"
        title="Buka Pengaturan Profil"
      >
        <AppAvatar user={user} size="sm" />
        <div className="flex flex-col gap-0 min-w-0">
          <span className="font-semibold text-sm leading-tight truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
            {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'User'}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight truncate">
            {store.name} · {formatCurrentDate()}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            const next = toggleSound();
            if (next) {
              sound.preview();
              notify.info('Efek suara pesanan diaktifkan.', 'Suara Notifikasi');
            } else {
              notify.info('Efek suara pesanan dibisukan (hening).', 'Suara Notifikasi');
            }
          }}
          aria-label={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
          title={soundEnabled ? 'Matikan Suara Pesanan' : 'Nyalakan Suara Pesanan'}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-750 active:scale-90 transition-all cursor-pointer bg-transparent border-0 text-gray-500"
        >
          {soundEnabled ? (
            <VolumeIcon size={19} color="#059669" />
          ) : (
            <VolumeMuteIcon size={19} color="#9ca3af" />
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('orders')}
          aria-label="Cari Pesanan"
          title="Cari Pesanan"
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-750 active:scale-90 transition-all cursor-pointer bg-transparent border-0 text-gray-500"
        >
          <SearchIcon size={19} color="#6b7280" />
        </button>
        <button
          type="button"
          onClick={() => {
            notify.info('Aplikasi Lontong Padang siap menerima pesanan.', 'Sistem Siap');
          }}
          aria-label="Notifikasi"
          title="Notifikasi"
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-750 active:scale-90 transition-all cursor-pointer bg-transparent border-0 text-gray-500"
        >
          <BellIcon size={19} color="#6b7280" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger ring-2 ring-white dark:ring-gray-800 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}