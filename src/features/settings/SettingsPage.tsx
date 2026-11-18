import { useState } from 'react';
import { PageContainer, AppAvatar, Toggle } from '../../components';
import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import { useThemeStore } from '../../stores/themeStore';
import { useStoreStore } from '../../stores/storeStore';
import { useSoundStore } from '../../stores/soundStore';
import { notify } from '../../stores/notificationStore';
import { sound } from '../../utils/sound';
import { APP_VERSION } from '../../constants';
import {
  LogoutIcon,
  MoonIcon,
  GlobeIcon,
  BellIcon,
  CrownIcon,
  Building2Icon,
  BadgeCheckIcon,
  StoreIcon,
  SaveIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from '../../utils/icons';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavStore((s) => s.navigate);
  const store = useStoreStore((s) => s.store);
  const updateStore = useStoreStore((s) => s.updateStore);

  const colorScheme = useThemeStore((s) => s.colorScheme);
  const toggleTheme = useThemeStore((s) => s.toggleColorScheme);

  const soundEnabled = useSoundStore((s) => s.soundEnabled);
  const toggleSound = useSoundStore((s) => s.toggleSound);

  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('id');
  const [storeName, setStoreName] = useState(store.name);
  const [storeAddress, setStoreAddress] = useState(store.address ?? '');
  const [storePhone, setStorePhone] = useState(store.phone ?? '');
  const [saved, setSaved] = useState(false);

  const isDark = colorScheme === 'dark';
  const isOwner = user?.role === 'owner';

  const handleLogout = () => {
    logout();
    notify.warning('Anda telah keluar dari aplikasi Lontong Padang.', 'Sesi Berakhir');
    navigate('dashboard');
  };

  const handleSaveStore = () => {
    updateStore({
      name: storeName.trim() || store.name,
      address: storeAddress.trim(),
      phone: storePhone.trim(),
    });
    setSaved(true);
    notify.success('Informasi profil toko berhasil diperbarui.', 'Pengaturan Disimpan');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageContainer>
      <section className="flex flex-col gap-3.5">
        <h5 className="font-bold text-lg dark:text-white">Pengaturan</h5>

        {/* Store profile */}
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <StoreIcon size={18} color="#6b7280" />
            <p className="font-semibold text-sm dark:text-gray-100">
              Profil Toko
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Nama Toko
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Alamat
              </label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                No. Telepon
              </label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
              <Building2Icon size={14} className="shrink-0" />
              <span>
                Mata uang: IDR · Zona waktu: {store.timezone} · ID toko:{' '}
                {store.id}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveStore}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-teal-600 text-white font-semibold text-sm cursor-pointer hover:brightness-105 active:scale-98 transition-all border-0 flex items-center justify-center gap-2 shadow-sm shadow-primary/25"
            >
              {saved ? (
                <>
                  <BadgeCheckIcon size={16} /> Tersimpan
                </>
              ) : (
                <>
                  <SaveIcon size={16} /> Simpan Profil
                </>
              )}
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <AppAvatar user={user} size="lg" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <h6 className="font-semibold text-base dark:text-white truncate">
                {user?.fullName ?? 'Pengguna'}
              </h6>
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {user?.email ?? ''}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                  isOwner
                    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                    : 'bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300'
                }`}
              >
                {isOwner ? (
                  <CrownIcon size={12} />
                ) : (
                  <BadgeCheckIcon size={12} />
                )}
                {isOwner ? 'Pemilik (Admin)' : 'Staf'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
            <p>
              <b className="text-gray-600 dark:text-gray-300">Pemilik:</b>{' '}
              kelola menu, koreksi/penutupan hari, laporan.
            </p>
            <p>
              <b className="text-gray-600 dark:text-gray-300">Staf:</b>{' '}
              catat &amp; proses pesanan. Struktur peran disiapkan untuk
              diterapkan di backend nanti.
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <MoonIcon size={18} color="#6b7280" className="shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm dark:text-gray-200">
                    Mode Gelap
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isDark ? 'Tema gelap aktif' : 'Beralih ke tema gelap'}
                  </span>
                </div>
              </div>
              <Toggle
                checked={isDark}
                onChange={() => {
                  toggleTheme();
                  notify.info(
                    isDark ? 'Mode terang diaktifkan.' : 'Mode gelap diaktifkan.',
                    'Tema Tampilan',
                  );
                }}
                label="Mode Gelap"
              />
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {soundEnabled ? (
                  <VolumeIcon size={18} color="#059669" className="shrink-0" />
                ) : (
                  <VolumeMuteIcon size={18} color="#9ca3af" className="shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm dark:text-gray-200">
                    Suara Notifikasi
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {soundEnabled
                      ? 'Lonceng pesanan & status aktif'
                      : 'Efek suara dibisukan (hening)'}
                  </span>
                </div>
              </div>
              <Toggle
                checked={soundEnabled}
                onChange={() => {
                  const next = toggleSound();
                  if (next) {
                    sound.preview();
                    notify.info(
                      'Efek suara pesanan diaktifkan.',
                      'Suara Notifikasi',
                    );
                  } else {
                    notify.info(
                      'Efek suara pesanan dinonaktifkan (hening).',
                      'Suara Notifikasi',
                    );
                  }
                }}
                label="Suara Notifikasi"
              />
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <GlobeIcon size={18} color="#6b7280" className="shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm dark:text-gray-200">
                    Bahasa
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Pilih bahasa Anda
                  </span>
                </div>
              </div>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  notify.info(
                    e.target.value === 'id' ? 'Bahasa Indonesia aktif' : 'English language selected',
                    'Pengaturan Bahasa',
                  );
                }}
                className="text-xs py-1.5 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 w-[110px] shrink-0 outline-none"
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <BellIcon size={18} color="#6b7280" className="shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm dark:text-gray-200">
                    Notifikasi
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Notifikasi push
                  </span>
                </div>
              </div>
              <Toggle
                checked={notifications}
                onChange={() => {
                  setNotifications((v) => {
                    const next = !v;
                    notify.info(
                      next ? 'Notifikasi push diaktifkan.' : 'Notifikasi push dinonaktifkan.',
                      'Notifikasi',
                    );
                    return next;
                  });
                }}
                label="Notifikasi"
              />
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-danger-50 dark:bg-danger-950/40 text-danger dark:text-danger-400 font-semibold text-sm cursor-pointer border border-danger-200 dark:border-danger-800/60 flex items-center justify-center gap-2 hover:bg-danger-100 dark:hover:bg-danger-900/40 active:scale-98 transition-all"
          >
            <LogoutIcon size={18} color="#dc2626" />
            Keluar
          </button>
        </div>

        <span className="text-gray-500 dark:text-gray-400 text-xs text-center">
          {store.name} · v{APP_VERSION}
        </span>
      </section>
    </PageContainer>
  );
}
