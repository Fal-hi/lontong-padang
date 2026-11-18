import { useState } from 'react';
import { PageContainer, AppAvatar, Toggle } from '../../components';
import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import { useThemeStore } from '../../stores/themeStore';
import { useStoreStore } from '../../stores/storeStore';
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
} from '../../utils/icons';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavStore((s) => s.navigate);
  const store = useStoreStore((s) => s.store);
  const updateStore = useStoreStore((s) => s.updateStore);

  const colorScheme = useThemeStore((s) => s.colorScheme);
  const toggleTheme = useThemeStore((s) => s.toggleColorScheme);

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
    navigate('dashboard');
  };

  const handleSaveStore = () => {
    updateStore({
      name: storeName.trim() || store.name,
      address: storeAddress.trim(),
      phone: storePhone.trim(),
    });
    setSaved(true);
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
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors"
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
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors"
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
                className="w-full py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 transition-colors"
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
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity border-0 flex items-center justify-center gap-2"
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
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
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
                onChange={toggleTheme}
                label="Mode Gelap"
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
                onChange={(e) => setLanguage(e.target.value)}
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
                onChange={() => setNotifications((v) => !v)}
                label="Notifikasi"
              />
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-sm cursor-pointer border-0 flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
